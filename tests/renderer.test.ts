import { test, expect } from "bun:test";
import { renderLine, renderHud } from "../src/renderer";
import type { Segment } from "../src/types";
import { COLORS } from "../src/colors";

test("renderLine with powerline joins segments with arrows", () => {
  const segments: Segment[] = [
    { text: "Opus", fg: COLORS.white, bg: COLORS.blue },
    { text: "42%", fg: COLORS.white, bg: COLORS.green },
  ];
  const output = renderLine(segments, true);
  expect(output).toContain("Opus");
  expect(output).toContain("42%");
  expect(output).toContain("\uE0B0");
});

test("renderLine with ASCII fallback uses >", () => {
  const segments: Segment[] = [
    { text: "Opus", fg: COLORS.white, bg: COLORS.blue },
    { text: "42%", fg: COLORS.white, bg: COLORS.green },
  ];
  const output = renderLine(segments, false);
  expect(output).toContain(">");
  expect(output).not.toContain("\uE0B0");
});

test("renderLine includes icon when present", () => {
  const segments: Segment[] = [
    { text: "$0.37", fg: COLORS.white, bg: COLORS.magenta, icon: "$" },
  ];
  const output = renderLine(segments, true);
  expect(output).toContain("$");
  expect(output).toContain("0.37");
});

test("renderLine with empty segments returns empty", () => {
  expect(renderLine([], true)).toBe("");
});

test("renderHud expanded mode has two lines when activity exists", () => {
  const line1: Segment[] = [{ text: "Opus", fg: COLORS.white, bg: COLORS.blue }];
  const line2: Segment[] = [{ text: "Read x3", fg: COLORS.white, bg: COLORS.gray }];
  const output = renderHud(line1, line2, true, "expanded");
  const lines = output.split("\n").filter(Boolean);
  expect(lines.length).toBe(2);
});

test("renderHud expanded mode has one line when no activity", () => {
  const line1: Segment[] = [{ text: "Opus", fg: COLORS.white, bg: COLORS.blue }];
  const output = renderHud(line1, [], true, "expanded");
  const lines = output.split("\n").filter(Boolean);
  expect(lines.length).toBe(1);
});

test("renderHud compact mode merges all segments", () => {
  const line1: Segment[] = [{ text: "Opus", fg: COLORS.white, bg: COLORS.blue }];
  const line2: Segment[] = [{ text: "Read x3", fg: COLORS.white, bg: COLORS.gray }];
  const output = renderHud(line1, line2, true, "compact");
  const lines = output.split("\n").filter(Boolean);
  expect(lines.length).toBe(1);
  expect(output).toContain("Opus");
  expect(output).toContain("Read x3");
});
