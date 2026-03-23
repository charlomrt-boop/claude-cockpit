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
