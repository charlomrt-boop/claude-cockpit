import type { Segment } from "../types";
import { COLORS } from "../colors";

export function usageSegment(
  fiveHourPct: number | null,
  sevenDayPct: number | null,
  showSevenDay: "auto" | "always" | "never",
  colors: { normal: number; warning: number }
): Segment | null {
  if (fiveHourPct === null && sevenDayPct === null) return null;

  const parts: string[] = [];

  if (fiveHourPct !== null) {
    parts.push(`USAGE 5h: ${fiveHourPct}%`);
  }

  const includeSevenDay =
    showSevenDay === "always" ||
    (showSevenDay === "auto" && sevenDayPct !== null);

  if (includeSevenDay && sevenDayPct !== null) {
    parts.push(`7d: ${sevenDayPct}%`);
  }

  if (parts.length === 0) return null;

  const maxPct = Math.max(fiveHourPct ?? 0, sevenDayPct ?? 0);
  const bgColor = maxPct >= 80 ? colors.warning : colors.normal;

  return {
    text: parts.join(" | "),
    fg: COLORS.white,
    bg: bgColor,
  };
}
