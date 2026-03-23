import { test, expect } from "bun:test";
import { fg, bg, reset, POWERLINE_RIGHT, POWERLINE_RIGHT_ASCII } from "../src/colors";

test("fg returns ANSI 256 foreground escape", () => {
  expect(fg(208)).toBe("\x1b[38;5;208m");
});

test("bg returns ANSI 256 background escape", () => {
  expect(bg(34)).toBe("\x1b[48;5;34m");
});

test("reset returns ANSI reset", () => {
  expect(reset()).toBe("\x1b[0m");
});

test("powerline constants are correct", () => {
  expect(POWERLINE_RIGHT).toBe("\uE0B0");
  expect(POWERLINE_RIGHT_ASCII).toBe(">");
});
