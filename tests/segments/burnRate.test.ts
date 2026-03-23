import { test, expect } from "bun:test";
import { burnRateSegment } from "../../src/segments/burnRate";
import { COLORS } from "../../src/colors";

const GREEN = { low: COLORS.green, mid: COLORS.yellow, high: COLORS.red };
const TWO_MIN = 2;

test("returns null when sessionStart is null", () => {
  expect(burnRateSegment(1.0, null, Date.now(), GREEN, TWO_MIN)).toBeNull();
});

test("returns null when session is less than minMinutes", () => {
  const now = Date.now();
  const sessionStart = now - 60_000; // 1 min ago
  expect(burnRateSegment(0.5, sessionStart, now, GREEN, TWO_MIN)).toBeNull();
});

test("returns segment after minMinutes", () => {
  const now = Date.now();
  const sessionStart = now - 3 * 60_000; // 3 min ago
  const seg = burnRateSegment(0.5, sessionStart, now, GREEN, TWO_MIN);
  expect(seg).not.toBeNull();
  expect(seg!.text).toContain("/h");
  expect(seg!.text).toContain("$");
  expect(seg!.icon).toBe("↗");
});

test("calculates correct rate: $0.50 over 30min = $1.00/h", () => {
  const now = Date.now();
  const sessionStart = now - 30 * 60_000;
  const seg = burnRateSegment(0.5, sessionStart, now, GREEN, TWO_MIN);
  expect(seg!.text).toBe("$1.00/h");
});

test("green color when rate < $5/h", () => {
  const now = Date.now();
  const sessionStart = now - 60 * 60_000; // 1h
  const seg = burnRateSegment(2.0, sessionStart, now, GREEN, TWO_MIN);
  expect(seg!.bg).toBe(COLORS.green);
});

test("yellow color when rate >= $5/h and < $15/h", () => {
  const now = Date.now();
  const sessionStart = now - 60 * 60_000; // 1h
  const seg = burnRateSegment(10.0, sessionStart, now, GREEN, TWO_MIN);
  expect(seg!.bg).toBe(COLORS.yellow);
});

test("red color when rate >= $15/h", () => {
  const now = Date.now();
  const sessionStart = now - 60 * 60_000; // 1h
  const seg = burnRateSegment(20.0, sessionStart, now, GREEN, TWO_MIN);
  expect(seg!.bg).toBe(COLORS.red);
});

test("zero cost shows $0.00/h in green", () => {
  const now = Date.now();
  const sessionStart = now - 10 * 60_000;
  const seg = burnRateSegment(0, sessionStart, now, GREEN, TWO_MIN);
  expect(seg!.text).toBe("$0.00/h");
  expect(seg!.bg).toBe(COLORS.green);
});
