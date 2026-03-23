# Breadcrumb Segment Design

**Date:** 2026-03-24
**Status:** Approved
**Replaces:** `todosSegment` (src/segments/todos.ts)

## Overview

Replace the current `todosSegment` (`▸ TODO 2/5`) with a visual breadcrumb that shows each plan step inline with its status, truncated adaptively to fit the terminal width.

**Example output:**
```
● Explore → ◐ Plan → ○ Impleme… → ○ Test
```

When steps overflow:
```
✓×3 → ◐ Plan multi… → ○ Test → ○ Review → ○ Deploy
```

## Input / Output

**Input:** `TodoEntry[]` from the transcript parser (unchanged):
```typescript
{ id: string, subject: string, status: "pending" | "in_progress" | "completed" }
```

**Output:** A single `Segment` with pre-formatted text and no icon (`icon` field omitted), or `null` if no todos. The breadcrumb embeds its own icons (●/◐/○) directly in the `text` field, unlike other segments that use `Segment.icon`. This avoids the renderer prepending a double icon.

**Signature:**
```typescript
function breadcrumbSegment(
  todos: TodoEntry[],
  bgColor: number,
  terminalWidth: number
): Segment | null
```

## Visual Design

### Icons by status
- `●` completed (filled circle)
- `◐` in_progress (half circle)
- `○` pending (empty circle)

### Separator
` → ` (space + U+2192 + space = 3 characters)

### Step format
`{icon} {truncated_subject}`

### Subject fallback
If `subject` is empty or whitespace-only, use `id` as fallback. Applied before any truncation.

## Adaptive Truncation Algorithm

### Budget calculation
1. `budget = floor(terminalWidth * 0.6)` (60% of width reserved for breadcrumb)
2. `separatorSpace = (stepCount - 1) * 3` (each ` → ` is 3 chars)
3. `availableForSteps = budget - separatorSpace`
4. If `availableForSteps <= 0`: skip to collapse strategy
5. `spacePerStep = floor(availableForSteps / stepCount) - 2` (minus icon + space)
6. If `spacePerStep < 1`: skip to collapse strategy

### Per-step truncation
- If `subject.length <= spacePerStep`: show full subject
- If `subject.length > spacePerStep` and `spacePerStep >= 2`: truncate to `spacePerStep - 1` chars + `…`
- If `spacePerStep === 1`: show first char only (no ellipsis)

### Collapse strategy (completed steps, left side)
When `spacePerStep < 1` or when explicitly triggered:
1. Take the first N completed steps (starting N=1), replace with `✓×N` (counts as 1 visual item, width = 3 + digits of N)
2. Recalculate budget with remaining items (collapsed group + uncollapsed steps)
3. The `in_progress` step is never collapsed
4. Increment N and repeat until `spacePerStep >= 1`

**Termination:** If all completed steps are collapsed and it still doesn't fit, apply hard truncation:
- Show only `✓×N → ◐ {active_truncated}` if there is an active step
- Show only `✓×N` if all steps are completed
- Show `○ {first_pending_truncated}` + ` +N` if there are only pending steps
- Truncate subjects to whatever fits in the remaining budget (minimum 1 char)

### Worked example: 8 steps, 80-col terminal

Assume 3 completed, 1 in_progress, 4 pending:
```
Budget: floor(80 * 0.6) = 48 chars
Step count: 8, Separators: 7 * 3 = 21
Available: 48 - 21 = 27 for 8 steps
spacePerStep = floor(27 / 8) - 2 = 1 → too small for readable text

Collapse 3 completed → ✓×3 (width=3, counts as 1 item)
Remaining items: 5 (✓×3 + 4 uncollapsed steps)
Separators: 4 * 3 = 12
Available: 48 - 12 = 36
Space for subjects: 36 - 3(✓×3) - (4 steps * 2 icon+space) = 25
spacePerStep for 4 uncollapsed = floor(25 / 4) = 6 chars each

Result: ✓×3 → ◐ Plan … → ○ Test → ○ Revie… → ○ Deplo…
```

## Integration

### Files modified
- `src/segments/todos.ts` → renamed to `src/segments/breadcrumb.ts`
- `src/index.ts` → update import, add `terminalWidth` param to `buildHud`
- `tests/segments/todos.test.ts` → renamed to `tests/segments/breadcrumb.test.ts`, new test cases
- `tests/integration.test.ts` → update todos assertions to match breadcrumb output format

### Files unchanged
- `src/types.ts` — `TodoEntry` and `Segment` stay identical
- `src/transcript.ts` — parsing unchanged
- `src/renderer.ts` — no modification
- `src/config.ts` — `segments.todos.enabled` reused as-is

### buildHud signature change
```typescript
// before
export function buildHud(
  stdin: StdinData | null,
  transcript: TranscriptData,
  config: CockpitConfig,
  now: number
): string

// after
export function buildHud(
  stdin: StdinData | null,
  transcript: TranscriptData,
  config: CockpitConfig,
  now: number,
  terminalWidth?: number  // defaults to 80
): string
```

`terminalWidth` is read from `process.stdout.columns` in `main()` and passed as argument. `buildHud` remains a pure function — no side-effectful env reads inside it.

### main() change
```typescript
const termWidth = process.stdout.columns || 80;
const output = buildHud(stdin, transcript, config, Date.now(), termWidth);
```

### breadcrumb call inside buildHud
```typescript
const seg = breadcrumbSegment(transcript.todos, config.colors.todos, terminalWidth ?? 80);
```

## Edge Cases

| Case | Behavior |
|------|----------|
| 0 todos | Return `null`, no segment displayed |
| 1 todo | `◐ Explorer le contexte projet` (no arrow) |
| All completed | `● Step1 → ● Step2 → ● Step3` |
| No in_progress | Normal display, no special "active" step |
| Very narrow terminal (<40) | Hard truncation: `✓×N → ◐ X…` or minimal form |
| Empty subject | Use `id` as fallback (before truncation) |
| All pending, no completed to collapse | Hard truncation on pending steps directly |
| Budget exhausted after full collapse | Minimal form with 1-char subjects |

## Design Decisions

- **Single Segment approach**: All rendering logic encapsulated in one file. Zero changes to renderer, types, or config schema. Monochrome is fine — visual richness comes from icons (●/◐/○) and arrows (→).
- **No `icon` field**: Unlike other segments, the breadcrumb embeds icons in `text` to avoid the renderer's automatic `icon + space + text` concatenation.
- **Pure function**: `terminalWidth` passed as parameter to `buildHud` rather than reading `process.stdout.columns` inside, preserving testability.
- **60% budget**: Leaves room for activity and agents segments on line 2 without needing to know their actual width.
- **Collapse left**: Completed steps are the least interesting — the user cares about where they are now and what's next.
- **Config reuse**: `segments.todos.enabled` and `colors.todos` are reused to avoid config breaking changes.
- **Separator is 3 chars**: ` → ` = space + arrow + space. Algorithm uses 3, not 4.
