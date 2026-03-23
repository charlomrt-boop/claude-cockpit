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

function maxSubjectLength(todos: TodoEntry[]): number {
  return Math.max(...todos.map((t) => getSubject(t).length));
}

function collapseCompleted(
  todos: TodoEntry[],
  budget: number,
): string {
  // Try without collapse first (just truncation)
  const spacePerStep = computeSpacePerStep(todos.length, budget);
  if (spacePerStep >= 1) {
    return todos
      .map((t) => `${ICONS[t.status]} ${truncate(getSubject(t), Math.max(spacePerStep, 1))}`)
      .join(SEPARATOR);
  }

  // Find completed step indices
  const completedIndices: number[] = [];
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].status === "completed") completedIndices.push(i);
  }

  // Try collapsing 1..N completed steps (minimal collapse first)
  for (let n = 1; n <= completedIndices.length; n++) {
    const collapsedLabel = `✓×${n}`;
    const remaining = todos.filter((_, i) => !completedIndices.slice(0, n).includes(i));
    const itemCount = 1 + remaining.length;
    const sepSpace = (itemCount - 1) * SEPARATOR.length;
    const available = budget - sepSpace - collapsedLabel.length;
    const perStep = remaining.length > 0 ? Math.floor(available / remaining.length) - 2 : 0;

    if (remaining.length === 0 && collapsedLabel.length <= budget) {
      return collapsedLabel;
    }
    if (perStep >= 1) {
      const parts = [collapsedLabel];
      for (const t of remaining) {
        parts.push(`${ICONS[t.status]} ${truncate(getSubject(t), Math.max(perStep, 1))}`);
      }
      return parts.join(SEPARATOR);
    }
  }

  // Hard truncation fallback
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
    const remaining = budget - prefix.length - 2;
    return `${prefix}◐ ${truncate(getSubject(active), Math.max(remaining, 1))}`;
  }
  if (n > 0) {
    return `✓×${n}`;
  }
  // Only pending steps
  const first = todos[0];
  const suffix = todos.length > 1 ? ` +${todos.length - 1}` : "";
  const available = budget - 2 - suffix.length;
  return `○ ${truncate(getSubject(first), Math.max(available, 1))}${suffix}`;
}

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
