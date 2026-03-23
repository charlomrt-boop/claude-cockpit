import type { Segment, AgentEntry } from "../types";
import { COLORS } from "../colors";

export function agentsSegment(agents: AgentEntry[], bgColor: number): Segment | null {
  if (agents.length === 0) return null;

  const last = agents[agents.length - 1];

  const icon = last.status === "running" ? "\u25D0" : "\u2713"; // ◐ or ✓

  const text = last.model
    ? `${last.name} (${last.model})`
    : last.name;

  return {
    text,
    fg: COLORS.white,
    bg: bgColor,
    icon,
  };
}
