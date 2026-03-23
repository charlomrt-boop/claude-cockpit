import type { Segment } from "../types";
import { COLORS } from "../colors";

const BAR_WIDTH = 8;
const FILLED = "█";
const EMPTY = "░";

export function contextSegment(
  percent: number,
  colors: { low: number; mid: number; high: number }
): Segment {
  let bgColor: number;
  if (percent < 50) {
    bgColor = colors.low;
  } else if (percent < 75) {
    bgColor = colors.mid;
  } else {
    bgColor = colors.high;
  }

  const filled = Math.round((percent / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = FILLED.repeat(filled) + EMPTY.repeat(empty);

  const text = `CTX ${bar} ${percent}%`;

  return {
    text,
    fg: COLORS.white,
    bg: bgColor,
  };
}
