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
  const seg = breadcrumbSegment(todos, COLORS.green, 15);
  expect(seg).not.toBeNull();
  expect(seg!.text.length).toBeGreaterThan(0);
});

test("all completed at narrow terminal collapses to checkmark", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "Step A", status: "completed" },
    { id: "2", subject: "Step B", status: "completed" },
    { id: "3", subject: "Step C", status: "completed" },
    { id: "4", subject: "Step D", status: "completed" },
    { id: "5", subject: "Step E", status: "completed" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 20);
  expect(seg).not.toBeNull();
  expect(seg!.text).toBe("✓×5");
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

test("only pending steps, no completed to collapse", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "LongPendingName", status: "pending" },
    { id: "2", subject: "AnotherLongOne", status: "pending" },
    { id: "3", subject: "YetAnotherStep", status: "pending" },
  ];
  const seg = breadcrumbSegment(todos, COLORS.green, 30);
  expect(seg).not.toBeNull();
  expect(seg!.text).not.toContain("✓×");
  expect(seg!.text).toContain("○");
});
