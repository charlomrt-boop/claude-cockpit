import { test, expect } from "bun:test";
import { activitySegment } from "../../src/segments/activity";
import { agentsSegment } from "../../src/segments/agents";
import { breadcrumbSegment } from "../../src/segments/breadcrumb";
import { COLORS } from "../../src/colors";
import type { ToolEntry, AgentEntry, TodoEntry } from "../../src/types";

test("activitySegment shows last tool with counts", () => {
  const tools: ToolEntry[] = [
    { id: "1", name: "Read", status: "completed" },
    { id: "2", name: "Read", status: "completed" },
    { id: "3", name: "Edit", status: "running" },
  ];
  const seg = activitySegment(tools, COLORS.gray);
  expect(seg).not.toBeNull();
  expect(seg!.text).toContain("Edit");
  expect(seg!.icon).toBe("\u25D0");
});

test("activitySegment returns null for empty tools", () => {
  expect(activitySegment([], COLORS.gray)).toBeNull();
});

test("agentsSegment shows running agent", () => {
  const agents: AgentEntry[] = [{ id: "1", name: "Find code", status: "running" }];
  const seg = agentsSegment(agents, COLORS.orange);
  expect(seg).not.toBeNull();
  expect(seg!.text).toContain("Find code");
});

test("agentsSegment returns null for empty", () => {
  expect(agentsSegment([], COLORS.orange)).toBeNull();
});

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
