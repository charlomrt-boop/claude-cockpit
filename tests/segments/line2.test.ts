import { test, expect } from "bun:test";
import { activitySegment } from "../../src/segments/activity";
import { agentsSegment } from "../../src/segments/agents";
import { todosSegment } from "../../src/segments/todos";
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

test("todosSegment shows completion count", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "A", status: "completed" },
    { id: "2", subject: "B", status: "in_progress" },
    { id: "3", subject: "C", status: "pending" },
  ];
  const seg = todosSegment(todos, COLORS.green);
  expect(seg).not.toBeNull();
  expect(seg!.text).toBe("TODO 1/3");
  expect(seg!.icon).toBe("\u25B8");
});

test("todosSegment returns null for empty", () => {
  expect(todosSegment([], COLORS.green)).toBeNull();
});
