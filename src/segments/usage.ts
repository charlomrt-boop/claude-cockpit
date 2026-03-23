import type { Segment } from "../types";
import { COLORS } from "../colors";

function formatTimeRemaining(resetsAtSec: number, nowMs: number): string {
  const diffMs = resetsAtSec * 1000 - nowMs;
  if (diffMs <= 0) return "0m";
  const totalMin = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}`;
  return `${minutes}m`;
}

export function usageSegment(
  fiveHourPct: number | null,
  fiveHourResets: number | null,
  sevenDayPct: number | null,
  sevenDayResets: number | null,
  showSevenDay: "auto" | "always" | "never",
  colors: { normal: number; warning: number },
  nowMs: number
): Segment | null {
  if (fiveHourPct === null && sevenDayPct === null) return null;

  const parts: string[] = [];

  if (fiveHourPct !== null) {
    let text = `5h: ${Math.round(fiveHourPct)}%`;
    if (fiveHourResets !== null) {
      text += ` (${formatTimeRemaining(fiveHourResets, nowMs)} left)`;
    }
    parts.push(text);
  }

  const includeSevenDay =
    showSevenDay === "always" ||
    (showSevenDay === "auto" && sevenDayPct !== null);

  if (includeSevenDay && sevenDayPct !== null) {
    let text = `7d: ${Math.round(sevenDayPct)}%`;
    if (sevenDayResets !== null) {
      text += ` (${formatTimeRemaining(sevenDayResets, nowMs)} left)`;
    }
    parts.push(text);
  }

  if (parts.length === 0) return null;

  const maxPct = Math.max(fiveHourPct ?? 0, sevenDayPct ?? 0);
  const bgColor = maxPct >= 80 ? colors.warning : colors.normal;

  return {
    text: `USAGE ${parts.join(" | ")}`,
    fg: COLORS.white,
    bg: bgColor,
  };
}
