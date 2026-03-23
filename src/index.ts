import type { StdinData, TranscriptData, CockpitConfig, Segment } from "./types";
import { readStdin, parseStdin, getModelTier, getModelLabel, getContextPercent } from "./stdin";
import { loadConfig } from "./config";
import { parseTranscript } from "./transcript";
import { renderHud } from "./renderer";
import { modelSegment } from "./segments/model";
import { contextSegment } from "./segments/context";
import { usageSegment } from "./segments/usage";
import { costSegment } from "./segments/cost";
import { durationSegment } from "./segments/duration";
import { sessionSegment } from "./segments/session";
import { activitySegment } from "./segments/activity";
import { agentsSegment } from "./segments/agents";
import { todosSegment } from "./segments/todos";

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildHud(
  stdin: StdinData | null,
  transcript: TranscriptData,
  config: CockpitConfig,
  now: number
): string {
  if (stdin === null) return "";

  const tier = getModelTier(stdin.model.id);
  // Use full display name like "[Opus 4.6 (1M context)]" for clarity
  const shortLabel = getModelLabel(stdin.model.display_name, stdin.model.id);
  const label = stdin.model.display_name
    ? `[${stdin.model.display_name}]`
    : `[${shortLabel}]`;
  const contextPct = Math.round(getContextPercent(stdin));

  // ── Line 1 ──────────────────────────────────────────────────────────────────
  const line1: Segment[] = [];

  // model — always enabled
  line1.push(modelSegment(label, config.colors.model));

  // context — always enabled
  line1.push(contextSegment(contextPct, config.colors.context));

  // usage (rate limits + time remaining)
  if (config.segments.usage.enabled) {
    const fiveHourPct = stdin.rate_limits?.five_hour?.used_percentage ?? null;
    const fiveHourResets = stdin.rate_limits?.five_hour?.resets_at ?? null;
    const sevenDayPct = stdin.rate_limits?.seven_day?.used_percentage ?? null;
    const sevenDayResets = stdin.rate_limits?.seven_day?.resets_at ?? null;
    const seg = usageSegment(
      fiveHourPct,
      fiveHourResets,
      sevenDayPct,
      sevenDayResets,
      config.segments.usage.showSevenDay,
      config.colors.usage,
      now
    );
    if (seg) line1.push(seg);
  }

  // cost
  if (config.segments.cost.enabled) {
    const usage = stdin.context_window.current_usage;
    const tokens = {
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      cacheRead: usage.cache_read_tokens ?? 0,
      cacheWrite: usage.cache_creation_tokens ?? 0,
    };
    line1.push(costSegment(tokens, tier, config.cost.prices, config.colors.cost));
  }

  // duration
  if (config.segments.duration.enabled) {
    const seg = durationSegment(transcript.sessionStart, now, config.colors.duration);
    if (seg) line1.push(seg);
  }

  // session name
  if (config.segments.session.enabled) {
    const seg = sessionSegment(transcript.sessionName, config.colors.session);
    if (seg) line1.push(seg);
  }

  // ── Line 2 ──────────────────────────────────────────────────────────────────
  const line2: Segment[] = [];

  // activity (tools)
  if (config.segments.activity.enabled) {
    const recentTools = transcript.tools.slice(-config.segments.activity.maxTools);
    const seg = activitySegment(recentTools, config.colors.activity);
    if (seg) line2.push(seg);
  }

  // agents
  if (config.segments.agents.enabled) {
    const seg = agentsSegment(transcript.agents, config.colors.agents);
    if (seg) line2.push(seg);
  }

  // todos
  if (config.segments.todos.enabled) {
    const seg = todosSegment(transcript.todos, config.colors.todos);
    if (seg) line2.push(seg);
  }

  return renderHud(line1, line2, config.powerlineGlyphs, config.layout);
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    const stdin = parseStdin(raw);

    if (!stdin) {
      process.stdout.write("[claude-cockpit] Initializing...\n");
      return;
    }

    const config = loadConfig();
    const transcript = await parseTranscript(stdin.transcript_path);
    const output = buildHud(stdin, transcript, config, Date.now());

    if (output) {
      process.stdout.write(output + "\n");
    }
  } catch (err) {
    process.stderr.write(
      `[claude-cockpit] error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

main();
