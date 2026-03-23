import type { Segment } from "../types";
import { COLORS } from "../colors";

export function durationSegment(
  sessionStartMs: number | null,
  nowMs: number,
  bgColor: number
): Segment | null {
  if (sessionStartMs === null) return null;

  const totalMinutes = Math.floor((nowMs - sessionStartMs) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let text: string;
  if (hours === 0) {
    text = `${totalMinutes}m`;
  } else {
    const paddedMinutes = String(minutes).padStart(2, "0");
    text = `${hours}h${paddedMinutes}`;
  }

  return {
    text,
    fg: COLORS.white,
    bg: bgColor,
  };
}
