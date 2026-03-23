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

test("whitespace-only subject falls back to id", () => {
  const todos: TodoEntry[] = [
    { id: "xyz", subject: "   ", status: "pending" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 120);
  expect(seg!.text).toBe("○ xyz");
});

test("segment has correct fg/bg and no icon", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "X", status: "pending" },
  ];
  const seg = breadcrumbSegment(todos, 42, 120);
  expect(seg!.fg).toBe(255);
  expect(seg!.bg).toBe(42);
  expect(seg!.icon).toBeUndefined();
});

test("truncates long subjects to fit budget", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Explorer le contexte projet", status: "completed" },
    { id: "2", subject: "Planifier implementation", status: "in_progress" },
    { id: "3", subject: "Implementer le code", status: "pending" },
    { id: "4", subject: "Tester et valider", status: "pending" },
  ];
  // terminal 60 → budget 36, sep 9, avail 27, spacePerStep = floor(27/4)-2 = 4
  const seg = breadcrumbSegment(todos, COLORS.green, 60);
  expect(seg).not.toBeNull();
  expect(seg!.text).toContain("…");
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
  const seg = breadcrumbSegment(todos, COLORS.green, 20);
  expect(seg).not.toBeNull();
  expect(seg!.text).toContain("●");
  expect(seg!.text).toContain("○");
});
