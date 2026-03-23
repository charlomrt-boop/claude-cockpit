# Breadcrumb Segment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `todosSegment` with a visual breadcrumb showing each plan step inline with adaptive truncation.

**Architecture:** Single new file `src/segments/breadcrumb.ts` replaces `src/segments/todos.ts`. Pure function, no icon field, all rendering self-contained. `buildHud` gains an optional `terminalWidth` param.

**Tech Stack:** TypeScript 5.7, Bun test runner, zero dependencies.

**Spec:** `docs/superpowers/specs/2026-03-24-breadcrumb-segment-design.md`

---

### Task 1: Core breadcrumb rendering (no truncation)

**Files:**
- Create: `src/segments/breadcrumb.ts`
- Create: `tests/segments/breadcrumb.test.ts`

- [ ] **Step 1: Write failing tests for basic rendering**

```typescript
// tests/segments/breadcrumb.test.ts
import { test, expect } from "bun:test";
import { breadcrumbSegment } from "../../src/segments/breadcrumb";
import { COLORS } from "../../src/colors";
import type { TodoEntry } from "../../src/types";

test("returns null for empty todos", () => {
  expect(breadcrumbSegment([], COLORS.green, 120)).toBeNull();
});

test("single pending step, no arrow", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Explore context", status: "pending" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 120);
  expect(seg).not.toBeNull();
  expect(seg!.text).toBe("○ Explore context");
  expect(seg!.icon).toBeUndefined();
});

test("single in_progress step", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Explore", status: "in_progress" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 120);
  expect(seg!.text).toBe("◐ Explore");
});

test("single completed step", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Done", status: "completed" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 120);
  expect(seg!.text).toBe("● Done");
});

test("multiple steps with arrows", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "A", status: "completed" },
    { id: "2", subject: "B", status: "in_progress" },
    { id: "3", subject: "C", status: "pending" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 120);
  expect(seg!.text).toBe("● A → ◐ B → ○ C");
});

test("empty subject falls back to id", () => {
  const todos: TodoEntry[] = [
    { id: "abc", subject: "", status: "pending" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 120);
  expect(seg!.text).toBe("○ abc");
});

test("segment has correct fg/bg and no icon", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "X", status: "pending" },
  ];
  const seg = breadcrumbSegment(todos, 42, 120);
  expect(seg!.fg).toBe(255); // COLORS.white
  expect(seg!.bg).toBe(42);
  expect(seg!.icon).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && bun test tests/segments/breadcrumb.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement basic breadcrumb (wide terminal, no truncation needed)**

```typescript
// src/segments/breadcrumb.ts
import type { Segment, TodoEntry } from "../types";
import { COLORS } from "../colors";

const ICONS = {
  completed: "●",
  in_progress: "◐",
  pending: "○",
} as const;

const SEPARATOR = " → ";

function getSubject(todo: TodoEntry): string {
  const s = todo.subject.trim();
  return s || todo.id;
}

function formatStep(todo: TodoEntry): string {
  return `${ICONS[todo.status]} ${getSubject(todo)}`;
}

export function breadcrumbSegment(
  todos: TodoEntry[],
  bgColor: number,
  terminalWidth: number,
): Segment | null {
  if (todos.length === 0) return null;

  const text = todos.map(formatStep).join(SEPARATOR);

  return {
    text,
    fg: COLORS.white,
    bg: bgColor,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && bun test tests/segments/breadcrumb.test.ts`
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/segments/breadcrumb.ts tests/segments/breadcrumb.test.ts
git commit -m "feat: add breadcrumb segment with basic rendering"
```

---

### Task 2: Adaptive truncation

**Files:**
- Modify: `src/segments/breadcrumb.ts`
- Modify: `tests/segments/breadcrumb.test.ts`

- [ ] **Step 1: Write failing tests for truncation**

```typescript
// append to tests/segments/breadcrumb.test.ts

test("truncates long subjects to fit budget", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Explorer le contexte projet", status: "completed" },
    { id: "2", subject: "Planifier implementation", status: "in_progress" },
    { id: "3", subject: "Implementer le code", status: "pending" },
    { id: "4", subject: "Tester et valider", status: "pending" },
  ];
  // terminal 60 → budget 36, sep 9, avail 27, spacePerStep ~4
  const seg = breadcrumbSegment(todos, COLORS.green, 60);
  expect(seg).not.toBeNull();
  // each subject should be truncated (contain …)
  expect(seg!.text).toContain("…");
  // should still have all 4 icons
  expect(seg!.text).toContain("●");
  expect(seg!.text).toContain("◐");
  expect(seg!.text).toContain("○");
});

test("no truncation when terminal is wide enough", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "A", status: "completed" },
    { id: "2", subject: "B", status: "in_progress" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 200);
  expect(seg!.text).toBe("● A → ◐ B");
});

test("handles single-char truncation at minimum space", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Alpha", status: "completed" },
    { id: "2", subject: "Beta", status: "pending" },
  ];
  // very tight: budget = 12, sep 3, avail 9, spacePerStep ~2
  const seg = breadcrumbSegment(todos, COLORS.green, 20);
  expect(seg).not.toBeNull();
  // should at least contain the icons
  expect(seg!.text).toContain("●");
  expect(seg!.text).toContain("○");
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && bun test tests/segments/breadcrumb.test.ts`
Expected: truncation test fails (subjects not truncated yet)

- [ ] **Step 3: Implement truncation logic**

Add to `src/segments/breadcrumb.ts`:

```typescript
function truncate(text: string, maxLen: number): string {
  if (maxLen <= 0) return "";
  if (text.length <= maxLen) return text;
  if (maxLen === 1) return text[0];
  return text.slice(0, maxLen - 1) + "…";
}

function computeSpacePerStep(stepCount: number, budget: number): number {
  if (stepCount <= 0) return 0;
  const separatorSpace = (stepCount - 1) * SEPARATOR.length;
  const available = budget - separatorSpace;
  if (available <= 0) return 0;
  return Math.floor(available / stepCount) - 2; // minus icon + space
}
```

Update `breadcrumbSegment` to use the budget:

```typescript
export function breadcrumbSegment(
  todos: TodoEntry[],
  bgColor: number,
  terminalWidth: number,
): Segment | null {
  if (todos.length === 0) return null;

  const budget = Math.floor(terminalWidth * 0.6);
  const spacePerStep = computeSpacePerStep(todos.length, budget);

  let text: string;
  if (spacePerStep >= maxSubjectLength(todos)) {
    // no truncation needed
    text = todos.map(formatStep).join(SEPARATOR);
  } else {
    text = todos
      .map((t) => `${ICONS[t.status]} ${truncate(getSubject(t), Math.max(spacePerStep, 1))}`)
      .join(SEPARATOR);
  }

  return { text, fg: COLORS.white, bg: bgColor };
}

function maxSubjectLength(todos: TodoEntry[]): number {
  return Math.max(...todos.map((t) => getSubject(t).length));
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && bun test tests/segments/breadcrumb.test.ts`
Expected: all 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/segments/breadcrumb.ts tests/segments/breadcrumb.test.ts
git commit -m "feat: add adaptive truncation to breadcrumb segment"
```

---

### Task 3: Collapse completed steps

**Files:**
- Modify: `src/segments/breadcrumb.ts`
- Modify: `tests/segments/breadcrumb.test.ts`

- [ ] **Step 1: Write failing tests for collapse**

```typescript
// append to tests/segments/breadcrumb.test.ts

test("collapses completed steps when too many steps for width", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Step one", status: "completed" },
    { id: "2", subject: "Step two", status: "completed" },
    { id: "3", subject: "Step three", status: "completed" },
    { id: "4", subject: "Active step", status: "in_progress" },
    { id: "5", subject: "Next step", status: "pending" },
    { id: "6", subject: "Final step", status: "pending" },
    { id: "7", subject: "Last one", status: "pending" },
    { id: "8", subject: "Very last", status: "pending" },
  ];
  // 40 col terminal → budget 24, 8 steps can't fit
  const seg = breadcrumbSegment(todos, COLORS.green, 40);
  expect(seg).not.toBeNull();
  expect(seg!.text).toContain("✓×");
  expect(seg!.text).toContain("◐");
});

test("hard truncation when even full collapse isn't enough", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Done", status: "completed" },
    { id: "2", subject: "Active", status: "in_progress" },
    { id: "3", subject: "Pend1", status: "pending" },
    { id: "4", subject: "Pend2", status: "pending" },
    { id: "5", subject: "Pend3", status: "pending" },
  ];
  // extremely narrow
  const seg = breadcrumbSegment(todos, COLORS.green, 15);
  expect(seg).not.toBeNull();
  // should still produce some output
  expect(seg!.text.length).toBeGreaterThan(0);
});

test("all completed, no collapse needed at wide terminal", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "A", status: "completed" },
    { id: "2", subject: "B", status: "completed" },
    { id: "3", subject: "C", status: "completed" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 120);
  expect(seg!.text).toBe("● A → ● B → ● C");
  expect(seg!.text).not.toContain("✓×");
});

test("all completed at narrow terminal collapses to checkmark", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Step A", status: "completed" },
    { id: "2", subject: "Step B", status: "completed" },
    { id: "3", subject: "Step C", status: "completed" },
    { id: "4", subject: "Step D", status: "completed" },
    { id: "5", subject: "Step E", status: "completed" },
  ];
  // very narrow: should collapse all completed
  const seg = breadcrumbSegment(todos, COLORS.green, 20);
  expect(seg).not.toBeNull();
  expect(seg!.text).toBe("✓×5");
});

test("only pending steps, no completed to collapse", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "LongPendingName", status: "pending" },
    { id: "2", subject: "AnotherLongOne", status: "pending" },
    { id: "3", subject: "YetAnotherStep", status: "pending" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 30);
  expect(seg).not.toBeNull();
  // no ✓× since nothing is completed
  expect(seg!.text).not.toContain("✓×");
  expect(seg!.text).toContain("○");
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && bun test tests/segments/breadcrumb.test.ts`
Expected: collapse tests fail

- [ ] **Step 3: Implement collapse logic**

Refactor `breadcrumbSegment` in `src/segments/breadcrumb.ts`:

```typescript
function collapseCompleted(
  todos: TodoEntry[],
  budget: number,
): string {
  // Try without collapse first
  let spacePerStep = computeSpacePerStep(todos.length, budget);
  if (spacePerStep >= 1) {
    return todos
      .map((t) => `${ICONS[t.status]} ${truncate(getSubject(t), Math.max(spacePerStep, 1))}`)
      .join(SEPARATOR);
  }

  // Find completed steps from the start (contiguous or not — we collapse first N completed)
  const completedIndices: number[] = [];
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].status === "completed") completedIndices.push(i);
  }

  // Try collapsing 1..N completed steps
  for (let n = 1; n <= completedIndices.length; n++) {
    const collapsedLabel = `✓×${n}`;
    const remaining = todos.filter((_, i) => !completedIndices.slice(0, n).includes(i));
    const itemCount = 1 + remaining.length; // collapsed group + remaining
    const sepSpace = (itemCount - 1) * SEPARATOR.length;
    const available = budget - sepSpace - collapsedLabel.length;
    const perStep = remaining.length > 0 ? Math.floor(available / remaining.length) - 2 : 0;

    if (perStep >= 1) {
      const parts = [collapsedLabel];
      for (const t of remaining) {
        parts.push(`${ICONS[t.status]} ${truncate(getSubject(t), Math.max(perStep, 1))}`);
      }
      return parts.join(SEPARATOR);
    }
  }

  // Hard truncation: all completed collapsed, minimal remaining
  return hardTruncate(todos, completedIndices, budget);
}

function hardTruncate(
  todos: TodoEntry[],
  completedIndices: number[],
  budget: number,
): string {
  const active = todos.find((t) => t.status === "in_progress");
  const n = completedIndices.length;

  if (n > 0 && active) {
    const prefix = `✓×${n}${SEPARATOR}`;
    const remaining = budget - prefix.length - 2; // icon + space
    return `${prefix}◐ ${truncate(getSubject(active), Math.max(remaining, 1))}`;
  }
  if (n > 0) {
    return `✓×${n}`;
  }
  // Only pending steps
  const first = todos[0];
  const suffix = todos.length > 1 ? ` +${todos.length - 1}` : "";
  const available = budget - 2 - suffix.length; // icon + space + suffix
  return `○ ${truncate(getSubject(first), Math.max(available, 1))}${suffix}`;
}
```

Update `breadcrumbSegment` to use `collapseCompleted`:

```typescript
export function breadcrumbSegment(
  todos: TodoEntry[],
  bgColor: number,
  terminalWidth: number,
): Segment | null {
  if (todos.length === 0) return null;

  const budget = Math.floor(terminalWidth * 0.6);
  const spacePerStep = computeSpacePerStep(todos.length, budget);

  let text: string;
  if (spacePerStep >= maxSubjectLength(todos)) {
    text = todos.map(formatStep).join(SEPARATOR);
  } else {
    text = collapseCompleted(todos, budget);
  }

  return { text, fg: COLORS.white, bg: bgColor };
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && bun test tests/segments/breadcrumb.test.ts`
Expected: all 15 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/segments/breadcrumb.ts tests/segments/breadcrumb.test.ts
git commit -m "feat: add collapse strategy for breadcrumb overflow"
```

---

### Task 4: Wire into buildHud and update integration tests

**Files:**
- Modify: `src/index.ts`
- Delete: `src/segments/todos.ts`
- Modify: `tests/segments/line2.test.ts`
- Modify: `tests/integration.test.ts`

- [ ] **Step 1: Update line2.test.ts — replace ONLY the 2 todos tests with breadcrumb tests**

`tests/segments/line2.test.ts` has 6 tests total. PRESERVE the 4 tests for `activitySegment` (2 tests) and `agentsSegment` (2 tests). Only replace the 2 `todosSegment` tests (lines 35-49) with:

```typescript
// replace import
import { breadcrumbSegment } from "../../src/segments/breadcrumb";

// replace the two todosSegment tests with:
test("breadcrumbSegment shows step progression", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "A", status: "completed" },
    { id: "2", subject: "B", status: "in_progress" },
    { id: "3", subject: "C", status: "pending" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 120);
  expect(seg).not.toBeNull();
  expect(seg!.text).toBe("● A → ◐ B → ○ C");
  expect(seg!.icon).toBeUndefined();
});

test("breadcrumbSegment returns null for empty", () => {
  expect(breadcrumbSegment([], COLORS.green, 120)).toBeNull();
});
```

- [ ] **Step 2: Update integration.test.ts — fix todos assertion**

In `tests/integration.test.ts`, the test "includes activity line with tools and todos" (line 79-85):

Replace:
```typescript
    // todos segment shows completed/total
    expect(result).toContain("1/2");
```

With:
```typescript
    // breadcrumb segment shows step progression
    expect(result).toContain("●");
    expect(result).toContain("○");
```

Also update `buildHud` calls to pass `terminalWidth` (5th arg):
- Line 52: `buildHud(mockStdin, mockTranscript, DEFAULT_CONFIG, mockNow, 120)`
- Line 60: `buildHud(null, mockTranscript, DEFAULT_CONFIG, mockNow, 120)`
- Line 72: `buildHud(mockStdin, mockTranscript, configNoCost, mockNow, 120)`
- Line 80: `buildHud(mockStdin, mockTranscript, DEFAULT_CONFIG, mockNow, 120)`
- Line 97: `buildHud(mockStdin, mockTranscript, configLine2Off, mockNow, 120)`
- Line 108: `buildHud(mockStdin, mockTranscript, compactConfig, mockNow, 120)`
- Line 113: `buildHud(mockStdin, mockTranscript, DEFAULT_CONFIG, mockNow, 120)`

- [ ] **Step 3: Update src/index.ts — swap import and add terminalWidth param**

In `src/index.ts`:

Replace import:
```typescript
// before
import { todosSegment } from "./segments/todos";
// after
import { breadcrumbSegment } from "./segments/breadcrumb";
```

Update `buildHud` signature:
```typescript
export function buildHud(
  stdin: StdinData | null,
  transcript: TranscriptData,
  config: CockpitConfig,
  now: number,
  terminalWidth: number = 80,
): string {
```

Replace todos segment call (around line 102-104):
```typescript
  // before
  if (config.segments.todos.enabled) {
    const seg = todosSegment(transcript.todos, config.colors.todos);
    if (seg) line2.push(seg);
  }
  // after
  if (config.segments.todos.enabled) {
    const seg = breadcrumbSegment(transcript.todos, config.colors.todos, terminalWidth);
    if (seg) line2.push(seg);
  }
```

Update `main()` to pass terminal width:
```typescript
const termWidth = process.stdout.columns || 80;
const output = buildHud(stdin, transcript, config, Date.now(), termWidth);
```

- [ ] **Step 4: Delete src/segments/todos.ts**

```bash
rm src/segments/todos.ts
```

- [ ] **Step 5: Run all tests**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && bun test`
Expected: all tests PASS, no references to deleted `todos.ts`

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/segments/breadcrumb.ts tests/segments/line2.test.ts tests/integration.test.ts
git rm src/segments/todos.ts
git commit -m "feat: replace todosSegment with breadcrumb in buildHud"
```

---

### Task 5: Build and verify

**Files:**
- Modify: `dist/cockpit.js` (rebuilt)

- [ ] **Step 1: Run full test suite**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && bun test`
Expected: all tests PASS

- [ ] **Step 2: Build the bundle**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && bun run build`
Expected: `dist/cockpit.js` regenerated without errors

- [ ] **Step 3: Smoke test with sample input**

Run: `cd C:/Users/skate/Desktop/Projets/claude-cockpit && echo '{"model":{"id":"claude-opus-4-6","display_name":"Claude Opus 4.6"},"session_id":"test","cwd":"/tmp","transcript_path":"/tmp/fake.jsonl","context_window":{"context_window_size":200000,"used_percentage":42,"current_usage":{"input_tokens":50000,"output_tokens":10000,"cache_creation_tokens":0,"cache_read_tokens":0}}}' | bun run dist/cockpit.js`
Expected: HUD output without errors (no breadcrumb since no transcript)

- [ ] **Step 4: Commit build**

```bash
git add dist/cockpit.js
git commit -m "build: rebuild bundle with breadcrumb segment"
```
