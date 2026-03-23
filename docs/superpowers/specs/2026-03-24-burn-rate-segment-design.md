# Burn Rate Segment Design

**Date:** 2026-03-24
**Status:** Approved

## Overview

New segment showing cost per hour (`$X.XX/h`) on line 1, after the cost segment. Threshold-based coloring gives an immediate visual signal on spending pace. Hidden during the first 2 minutes to avoid misleading spikes.

## Input / Output

**Signature:**
```typescript
function burnRateSegment(
  cost: number,
  sessionStart: number | null,
  now: number,
  colors: { low: number; mid: number; high: number },
  minMinutes: number,
): Segment | null
```

**Returns:** `Segment` with text `$X.XX/h`, icon `↗`, or `null` if session too short.

## Logic

1. If `sessionStart` is null or `(now - sessionStart) < minMinutes * 60_000` → return `null`
2. `durationHours = (now - sessionStart) / 3_600_000`
3. `rate = cost / durationHours`
4. Round to 2 decimal places
5. Color: `rate < 5` → low (green), `rate < 15` → mid (yellow), else → high (red)
6. Text: `$X.XX/h`
7. Icon: `↗`

## Placement

Line 1, immediately after the cost segment.

## Config

Added to `CockpitConfig`:
```typescript
segments.burnRate: { enabled: boolean; minMinutes: number }
colors.burnRate: { low: number; mid: number; high: number }
```

**Defaults:**
- `enabled: true`
- `minMinutes: 2`
- `colors.burnRate.low: 34` (green)
- `colors.burnRate.mid: 220` (yellow)
- `colors.burnRate.high: 196` (red)

Thresholds ($5/$15) are hardcoded — not configurable.

## Files

- Create: `src/segments/burnRate.ts`
- Create: `tests/segments/burnRate.test.ts`
- Modify: `src/types.ts` — add burnRate to CockpitConfig
- Modify: `src/config.ts` — add defaults + validation
- Modify: `src/index.ts` — wire segment after cost
- Modify: `tests/segments/line1.test.ts` — add test

## Edge Cases

| Case | Behavior |
|------|----------|
| Session < minMinutes | Return `null` |
| Cost = 0 | `$0.00/h` in green |
| Session exactly 2 min, cost $0.50 | `$15.00/h` in red |
| sessionStart is null | Return `null` |
| Very long session, low cost | Small rate, green |
