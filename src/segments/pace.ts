import type { Segment } from "../types";
import { COLORS } from "../colors";

const DAILY_BUDGET = 100 / 7; // ~14.29% of weekly quota per day
const MIN_ELAPSED_DAYS = 0.04; // ~1 hour — not enough data below this

export function paceSegment(
  sevenDayPct: number | null,
  sevenDayResetsSec: number | null,
  colors: { low: number; mid: number; high: number },
  nowMs: number
): Segment | null {
  if (sevenDayPct === null || sevenDayResetsSec === null) return null;

  const msLeft = sevenDayResetsSec * 1000 - nowMs;
  const daysLeft = msLeft / 86_400_000;
  const daysElapsed = 7 - daysLeft;

  if (daysElapsed < MIN_ELAPSED_DAYS) return null;

  const dailyRate = sevenDayPct / daysElapsed;
  const pacePct = Math.round((dailyRate / DAILY_BUDGET) * 100);

  let bgColor: number;
  if (pacePct <= 100) {
    bgColor = colors.low;
  } else if (pacePct <= 130) {
    bgColor = colors.mid;
  } else {
    bgColor = colors.high;
  }

  return {
    text: `PACE ${pacePct}%`,
    fg: COLORS.white,
    bg: bgColor,
  };
}
