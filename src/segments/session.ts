import type { Segment } from "../types";
import { COLORS } from "../colors";

export function sessionSegment(
  name: string | null,
  bgColor: number
): Segment | null {
  if (!name || name.trim().length === 0) return null;

  return {
    text: name,
    fg: COLORS.white,
    bg: bgColor,
  };
}
