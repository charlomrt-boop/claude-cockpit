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

**Output:** A single `Segment` with pre-formatted text, or `null` if no todos.

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
` → ` (U+2192 with spaces, 4 characters)

### Step format
`{icon} {truncated_subject}`

## Adaptive Truncation Algorithm

### Budget calculation
1. `budget = terminalWidth * 0.6` (60% of width reserved for breadcrumb)
2. `separatorSpace = (stepCount - 1) * 4`
3. `availableForSteps = budget - separatorSpace`
4. `spacePerStep = floor(availableForSteps / stepCount) - 2` (minus icon + space)

### Per-step truncation
- If `subject.length <= spacePerStep`: show full subject
- If `subject.length > spacePerStep`: truncate to `spacePerStep - 1` chars + `…`
- Minimum 3 chars per step (icon + 1 letter + `…`), otherwise trigger collapse

### Collapse strategy (completed steps, left side)
When steps cannot fit at minimum 3 chars each:
1. Take the first N completed steps, replace with `✓×N` (counts as 1 visual item)
2. Recalculate space with remaining steps
3. The `in_progress` step is never collapsed
4. Collapse one more completed step at a time until it fits

### Example: 8 steps, 80-col terminal
```
Budget: 48 chars (80 * 0.6)
Separators: 7 * 4 = 28 → leaves 20 for 8 steps = 2.5/step → too small
Collapse 3 completed → ✓×3 → ◐ Plan multi… → ○ Test → ○ Review → ○ Deploy
Separators: 4 * 4 = 16 → leaves 32 for 5 items = ~6 chars/step → fits
```

## Integration

### Files modified
- `src/segments/todos.ts` → renamed to `src/segments/breadcrumb.ts`
- `src/index.ts` → update import, pass `terminalWidth`
- `tests/segments/todos.test.ts` → renamed to `tests/segments/breadcrumb.test.ts`, new test cases

### Files unchanged
- `src/types.ts` — `TodoEntry` and `Segment` stay identical
- `src/transcript.ts` — parsing unchanged
- `src/renderer.ts` — no modification
- `src/config.ts` — `segments.todos.enabled` reused as-is

### index.ts change
```typescript
// before
import { todosSegment } from "./segments/todos";
const seg = todosSegment(transcript.todos, config.colors.todos);

// after
import { breadcrumbSegment } from "./segments/breadcrumb";
const termWidth = process.stdout.columns || 80;
const seg = breadcrumbSegment(transcript.todos, config.colors.todos, termWidth);
```

## Edge Cases

| Case | Behavior |
|------|----------|
| 0 todos | Return `null`, no segment displayed |
| 1 todo | `◐ Explorer le contexte projet` (no arrow) |
| All completed | `● Step1 → ● Step2 → ● Step3` |
| No in_progress | Normal display, no special "active" step |
| Very narrow terminal (<40) | Max collapse, minimum `✓×N → ◐ X…` |
| Empty subject | Use `id` as fallback |

## Design Decisions

- **Single Segment approach**: All rendering logic encapsulated in one file. Zero changes to renderer, types, or config schema. Monochrome is fine — visual richness comes from icons (●/◐/○) and arrows (→).
- **60% budget**: Leaves room for activity and agents segments on line 2 without needing to know their actual width.
- **Collapse left**: Completed steps are the least interesting — the user cares about where they are now and what's next.
- **Config reuse**: `segments.todos.enabled` and `colors.todos` are reused to avoid config breaking changes.
