import type { Segment, TodoEntry } from "../types";
import { COLORS } from "../colors";

export function todosSegment(todos: TodoEntry[], bgColor: number): Segment | null {
  if (todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;

  return {
    text: `TODO ${completed}/${total}`,
    fg: COLORS.white,
    bg: bgColor,
    icon: "\u25B8", // ▸
  };
}
