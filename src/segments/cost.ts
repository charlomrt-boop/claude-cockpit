import type { Segment, ModelTier, CockpitConfig } from "../types";
import { COLORS } from "../colors";

type Prices = CockpitConfig["cost"]["prices"];
type TokenCounts = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export function costSegment(
  tokens: TokenCounts,
  tier: ModelTier | null,
  prices: Prices,
  bgColor: number
): Segment {
  let costText: string;

  if (tier === null) {
    costText = "COST ~$?.??";
  } else {
    const p = prices[tier];
    const cost =
      (tokens.input * p.input +
        tokens.output * p.output +
        tokens.cacheRead * p.cacheRead +
        tokens.cacheWrite * p.cacheWrite) /
      1_000_000;

    costText = `COST ~$${cost.toFixed(2)}`;
  }

  return {
    text: costText,
    fg: COLORS.white,
    bg: bgColor,
  };
}
