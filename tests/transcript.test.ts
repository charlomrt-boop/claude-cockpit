import { test, expect } from "bun:test";
import { parseTranscriptLines } from "../src/transcript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixture = readFileSync(resolve(import.meta.dir, "fixtures/transcript.jsonl"), "utf-8");
const lines = fixture.trim().split("\n");

test("parseTranscriptLines extracts tools", () => {
  const data = parseTranscriptLines(lines);
  expect(data.tools.length).toBeGreaterThanOrEqual(2);
  expect(data.tools[0].name).toBe("Read");
  expect(data.tools[0].status).toBe("completed");
  expect(data.tools[1].name).toBe("Edit");
  expect(data.tools[1].status).toBe("running");
});

test("parseTranscriptLines extracts agents", () => {
  const data = parseTranscriptLines(lines);
  expect(data.agents.length).toBe(1);
  expect(data.agents[0].status).toBe("completed");
});

test("parseTranscriptLines extracts session name", () => {
  const data = parseTranscriptLines(lines);
  expect(data.sessionName).toBe("fix-auth-bug");
});

test("parseTranscriptLines extracts session start", () => {
  const data = parseTranscriptLines(lines);
  expect(data.sessionStart).not.toBeNull();
});

test("TaskCreate + tool_result patches real ID, TaskUpdate finds it", () => {
  const lines = [
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-03-24T10:00:00Z",
      message: {
        content: [{
          type: "tool_use",
          id: "toolu_abc",
          name: "TaskCreate",
          input: { subject: "Write tests", description: "Write unit tests" },
        }],
      },
    }),
    JSON.stringify({
      type: "tool_result",
      tool_use_id: "toolu_abc",
      content: "Task #7 created successfully: Write tests",
    }),
    JSON.stringify({
      type: "assistant",
      message: {
        content: [{
          type: "tool_use",
          id: "toolu_def",
          name: "TaskUpdate",
          input: { taskId: "7", status: "completed" },
        }],
      },
    }),
  ];
  const data = parseTranscriptLines(lines);
  expect(data.todos).toHaveLength(1);
  expect(data.todos[0].id).toBe("7");
  expect(data.todos[0].subject).toBe("Write tests");
  expect(data.todos[0].status).toBe("completed");
});

test("parseTranscriptLines handles empty input", () => {
  const data = parseTranscriptLines([]);
  expect(data.tools).toEqual([]);
  expect(data.agents).toEqual([]);
  expect(data.todos).toEqual([]);
  expect(data.sessionStart).toBeNull();
  expect(data.sessionName).toBeNull();
});
