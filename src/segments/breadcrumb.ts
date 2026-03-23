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
    text = todos
      .map((t) => `${ICONS[t.status]} ${truncate(getSubject(t), Math.max(spacePerStep, 1))}`)
      .join(SEPARATOR);
  }

  return {
    text,
    fg: COLORS.white,
    bg: bgColor,
  };
}
