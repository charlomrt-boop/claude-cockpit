import type { Segment } from "../types";
import { COLORS } from "../colors";

export function modelSegment(label: string, bgColor: number): Segment {
  return {
    text: label && label.trim().length > 0 ? label : "Unknown",
    fg: COLORS.white,
    bg: bgColor,
  };
}
