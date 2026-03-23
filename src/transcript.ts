import { createHash } from "node:crypto";
import { readFileSync, statSync, mkdirSync, existsSync, readFile, open } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { TranscriptData, ToolEntry, AgentEntry, TodoEntry } from "./types";

// === JSONL line types (raw) ===

interface RawToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface RawAssistantLine {
  type: "assistant";
  timestamp?: string;
  message: { content: RawToolUse[] };
}

interface RawToolResultLine {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface RawCustomTitleLine {
  type: "custom-title";
  title: string;
}

type RawLine = RawAssistantLine | RawToolResultLine | RawCustomTitleLine | { type: string };

// === Cache types ===

interface CacheEntry {
  mtime: number;
  size: number;
  /** byte offset at which the last successful read ended */
  offset: number;
  /** whether the last read ended exactly on a newline boundary */
  endsOnNewline: boolean;
  data: TranscriptData;
}

// === Core parser ===

/**
 * Parse an array of JSONL text lines and return TranscriptData.
 * Tools are capped at 20 (most recent), agents at 10 (most recent).
 */
export function parseTranscriptLines(lines: string[]): TranscriptData {
  const toolMap = new Map<string, ToolEntry>();
  const agentMap = new Map<string, AgentEntry>();
  let todos: TodoEntry[] = [];
  let sessionStart: number | null = null;
  let sessionName: string | null = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let entry: RawLine;
    try {
      entry = JSON.parse(trimmed) as RawLine;
    } catch {
      continue;
    }

    if (entry.type === "custom-title") {
      sessionName = (entry as RawCustomTitleLine).title;
      continue;
    }

    if (entry.type === "assistant") {
      const line = entry as RawAssistantLine;

      // Capture first timestamp as sessionStart
      if (sessionStart === null && line.timestamp) {
        const ts = Date.parse(line.timestamp);
        if (!isNaN(ts)) sessionStart = ts;
      }

      const content = line.message?.content;
      if (!Array.isArray(content)) continue;

      for (const block of content) {
        if (block.type !== "tool_use") continue;

        if (block.name === "Task") {
          const input = block.input as { description?: string; model?: string };
          agentMap.set(block.id, {
            id: block.id,
            name: block.name,
            model: input.model,
            description: input.description,
            status: "running",
          });
        } else if (block.name === "TodoWrite") {
          // input.todos replaces the entire list
          const input = block.input as { todos?: Array<{ id: string; content?: string; status?: string }> };
          if (Array.isArray(input.todos)) {
            todos = input.todos.map((t) => ({
              id: String(t.id),
              subject: String(t.content ?? t.id),
              status: normalizeTodoStatus(t.status),
            }));
          }
        } else if (block.name === "TaskCreate") {
          const input = block.input as { id?: string; subject?: string; description?: string };
          todos.push({
            id: String(input.id ?? block.id),
            subject: String(input.subject ?? input.description ?? block.id),
            status: "pending",
          });
        } else if (block.name === "TaskUpdate") {
          const input = block.input as { id?: string; status?: string };
          const targetId = String(input.id ?? "");
          const newStatus = normalizeTodoStatus(input.status);
          const existing = todos.find((t) => t.id === targetId);
          if (existing) existing.status = newStatus;
        } else {
          // Generic tool
          toolMap.set(block.id, {
            id: block.id,
            name: block.name,
            status: "running",
          });
        }
      }
      continue;
    }

    if (entry.type === "tool_result") {
      const line = entry as RawToolResultLine;
      const id = line.tool_use_id;

      if (toolMap.has(id)) {
        toolMap.get(id)!.status = line.is_error ? "error" : "completed";
      } else if (agentMap.has(id)) {
        agentMap.get(id)!.status = line.is_error ? "error" : "completed";
      }
      continue;
    }
  }

  // Convert maps to arrays, most-recent first, capped
  const tools = [...toolMap.values()].slice(-20);
  const agents = [...agentMap.values()].slice(-10);

  return { tools, agents, todos, sessionStart, sessionName };
}

function normalizeTodoStatus(raw: unknown): TodoEntry["status"] {
  if (raw === "in_progress") return "in_progress";
  if (raw === "completed") return "completed";
  return "pending";
}

// === File-based parser with incremental cache ===

function getCacheDir(): string {
  return join(homedir(), ".claude", "plugins", "claude-cockpit", "cache");
}

function getCachePath(transcriptPath: string): string {
  const hash = createHash("sha256").update(transcriptPath).digest("hex").slice(0, 16);
  return join(getCacheDir(), `${hash}.json`);
}

function readCache(cachePath: string): CacheEntry | null {
  try {
    const raw = readFileSync(cachePath, "utf-8");
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(cachePath: string, entry: CacheEntry): void {
  try {
    mkdirSync(getCacheDir(), { recursive: true });
    // Write atomically via Bun.write if available, else sync write
    const content = JSON.stringify(entry);
    require("node:fs").writeFileSync(cachePath, content, "utf-8");
  } catch {
    // Cache write failure is non-fatal
  }
}

function mergeData(base: TranscriptData, incremental: TranscriptData): TranscriptData {
  // Merge tools: update existing by id, append new
  const toolMap = new Map(base.tools.map((t) => [t.id, t]));
  for (const t of incremental.tools) toolMap.set(t.id, t);

  // Merge agents: same strategy
  const agentMap = new Map(base.agents.map((a) => [a.id, a]));
  for (const a of incremental.agents) agentMap.set(a.id, a);

  return {
    tools: [...toolMap.values()].slice(-20),
    agents: [...agentMap.values()].slice(-10),
    todos: incremental.todos.length > 0 ? incremental.todos : base.todos,
    sessionStart: base.sessionStart ?? incremental.sessionStart,
    sessionName: incremental.sessionName ?? base.sessionName,
  };
}

/**
 * Parse a transcript file with incremental cache.
 * - Full reparse when file shrank (compaction).
 * - Incremental read from last offset when file grew.
 */
export async function parseTranscript(transcriptPath: string): Promise<TranscriptData> {
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(transcriptPath);
  } catch {
    return { tools: [], agents: [], todos: [], sessionStart: null, sessionName: null };
  }

  const currentMtime = stat.mtimeMs;
  const currentSize = stat.size;
  const cachePath = getCachePath(transcriptPath);
  const cached = readCache(cachePath);

  // --- Full reparse cases ---
  const needFullReparse =
    cached === null ||
    currentSize < cached.size; // file shrank = compaction

  if (needFullReparse) {
    let content: string;
    try {
      content = readFileSync(transcriptPath, "utf-8");
    } catch {
      return { tools: [], agents: [], todos: [], sessionStart: null, sessionName: null };
    }
    const lines = content.split("\n");
    const data = parseTranscriptLines(lines);
    // Determine whether content ends on newline boundary
    const endsOnNewline = content.endsWith("\n");
    writeCache(cachePath, {
      mtime: currentMtime,
      size: currentSize,
      offset: currentSize,
      endsOnNewline,
      data,
    });
    return data;
  }

  // --- No change ---
  if (currentMtime === cached.mtime && currentSize === cached.size) {
    return cached.data;
  }

  // --- Incremental read ---
  // File grew: read new bytes from cached.offset
  const fd = require("node:fs").openSync(transcriptPath, "r");
  let newContent = "";
  try {
    const newBytes = currentSize - cached.offset;
    if (newBytes > 0) {
      const buf = Buffer.alloc(newBytes);
      require("node:fs").readSync(fd, buf, 0, newBytes, cached.offset);
      newContent = buf.toString("utf-8");
    }
  } finally {
    require("node:fs").closeSync(fd);
  }

  if (!newContent) {
    // Nothing new to read
    const updatedCache: CacheEntry = { ...cached, mtime: currentMtime, size: currentSize };
    writeCache(cachePath, updatedCache);
    return cached.data;
  }

  let textToParse = newContent;

  // If the previous read did NOT end on a newline, the first "line" in newContent
  // is actually a continuation of the last partial line from the previous read.
  // We must discard that partial prefix up to the first newline.
  if (!cached.endsOnNewline) {
    const firstNl = textToParse.indexOf("\n");
    if (firstNl !== -1) {
      textToParse = textToParse.slice(firstNl + 1);
    } else {
      // Still no newline — entire new content is still a partial line
      textToParse = "";
    }
  }

  const endsOnNewline = newContent.endsWith("\n");
  const newLines = textToParse.split("\n");
  const incremental = parseTranscriptLines(newLines);
  const merged = mergeData(cached.data, incremental);

  writeCache(cachePath, {
    mtime: currentMtime,
    size: currentSize,
    offset: currentSize,
    endsOnNewline,
    data: merged,
  });

  return merged;
}
