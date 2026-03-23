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

test("parseTranscriptLines handles empty input", () => {
  const data = parseTranscriptLines([]);
  expect(data.tools).toEqual([]);
  expect(data.agents).toEqual([]);
  expect(data.todos).toEqual([]);
  expect(data.sessionStart).toBeNull();
  expect(data.sessionName).toBeNull();
});
