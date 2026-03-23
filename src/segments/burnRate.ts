import type { Segment } from "../types";
import { COLORS } from "../colors";

export function burnRateSegment(
  cost: number,
  sessionStart: number | null,
  now: number,
  colors: { low: number; mid: number; high: number },
  minMinutes: number,
): Segment | null {
  if (sessionStart === null) return null;

  const durationMs = now - sessionStart;
  if (durationMs < minMinutes * 60_000) return null;

  const durationHours = durationMs / 3_600_000;
  const rate = cost / durationHours;
  const rounded = Math.round(rate * 100) / 100;

  let bgColor: number;
  if (rounded < 5) {
    bgColor = colors.low;
  } else if (rounded < 15) {
    bgColor = colors.mid;
  } else {
    bgColor = colors.high;
  }

  return {
    text: `$${rounded.toFixed(2)}/h`,
    fg: COLORS.white,
    bg: bgColor,
    icon: "↗",
  };
}
