import { test, expect, describe } from "bun:test";
import { buildHud } from "../src/index";
import type { StdinData, TranscriptData, CockpitConfig } from "../src/types";
import { DEFAULT_CONFIG } from "../src/config";

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockStdin: StdinData = {
  model: {
    id: "claude-opus-4-6",
    display_name: "Claude Opus 4.6",
  },
  session_id: "sess-abc123",
  cwd: "/home/user/project",
  transcript_path: "/home/user/.claude/transcripts/abc123.jsonl",
  context_window: {
    context_window_size: 200000,
    used_percentage: 42,
    current_usage: {
      input_tokens: 50000,
      output_tokens: 10000,
      cache_creation_tokens: 5000,
      cache_read_tokens: 19000,
    },
  },
  rate_limits: {
    five_hour: { used_percentage: 20, resets_at: Date.now() + 3_600_000 },
    seven_day: { used_percentage: 10, resets_at: Date.now() + 86_400_000 },
  },
};

const mockTranscript: TranscriptData = {
  tools: [
    { id: "t1", name: "Bash", status: "completed" },
    { id: "t2", name: "Read", status: "running" },
  ],
  agents: [],
  todos: [
    { id: "todo1", subject: "Write tests", status: "completed" },
    { id: "todo2", subject: "Implement feature", status: "pending" },
  ],
  sessionStart: Date.now() - 30 * 60_000, // 30 minutes ago
  sessionName: "my-session",
};

const mockNow = Date.now();

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildHud", () => {
  test("returns non-empty output with full mock data", () => {
    const result = buildHud(mockStdin, mockTranscript, DEFAULT_CONFIG, mockNow);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("Opus 4.6");
    expect(result).toContain("42%");
    expect(result).toContain("~$");
  });

  test("returns empty string when stdin is null", () => {
    const result = buildHud(null, mockTranscript, DEFAULT_CONFIG, mockNow);
    expect(result).toBe("");
  });

  test("cost not in output when cost segment is disabled", () => {
    const configNoCost: CockpitConfig = {
      ...DEFAULT_CONFIG,
      segments: {
        ...DEFAULT_CONFIG.segments,
        cost: { enabled: false },
      },
    };
    const result = buildHud(mockStdin, mockTranscript, configNoCost, mockNow);
    expect(result).not.toContain("~$");
    // model and context are always present
    expect(result).toContain("Opus 4.6");
    expect(result).toContain("42%");
  });

  test("includes activity line with tools and todos", () => {
    const result = buildHud(mockStdin, mockTranscript, DEFAULT_CONFIG, mockNow);
    // activity segment shows last tool name
    expect(result).toContain("Read");
    // todos segment shows completed/total
    expect(result).toContain("1/2");
  });

  test("output does not contain cost when all line2 segments are disabled", () => {
    const configLine2Off: CockpitConfig = {
      ...DEFAULT_CONFIG,
      segments: {
        ...DEFAULT_CONFIG.segments,
        activity: { enabled: false, maxTools: 5 },
        agents: { enabled: false },
        todos: { enabled: false },
      },
    };
    const result = buildHud(mockStdin, mockTranscript, configLine2Off, mockNow);
    expect(result).toContain("Opus 4.6");
    // no todos shown
    expect(result).not.toContain("1/2");
  });

  test("compact layout puts everything on one line (no newline)", () => {
    const compactConfig: CockpitConfig = {
      ...DEFAULT_CONFIG,
      layout: "compact",
    };
    const result = buildHud(mockStdin, mockTranscript, compactConfig, mockNow);
    expect(result).not.toContain("\n");
  });

  test("expanded layout may contain a newline when line2 has segments", () => {
    const result = buildHud(mockStdin, mockTranscript, DEFAULT_CONFIG, mockNow);
    expect(result).toContain("\n");
  });
});
