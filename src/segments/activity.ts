import type { Segment, ToolEntry } from "../types";
import { COLORS } from "../colors";

export function activitySegment(tools: ToolEntry[], bgColor: number): Segment | null {
  if (tools.length === 0) return null;

  const last = tools[tools.length - 1];
  const completed = tools.filter((t) => t.status === "completed").length;

  let icon: string;
  if (last.status === "running") {
    icon = "\u25D0"; // ◐
  } else if (last.status === "completed") {
    icon = "\u2713"; // ✓
  } else {
    icon = "\u2717"; // ✗
  }

  const text = completed > 0
    ? `${last.name} (${completed})`
    : last.name;

  return {
    text,
    fg: COLORS.white,
    bg: bgColor,
    icon,
  };
}
