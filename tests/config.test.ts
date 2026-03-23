import { test, expect } from "bun:test";
import { loadConfigFromString, DEFAULT_CONFIG } from "../src/config";

test("loadConfigFromString returns defaults on empty string", () => {
  const config = loadConfigFromString("");
  expect(config).toEqual(DEFAULT_CONFIG);
});

test("loadConfigFromString returns defaults on invalid JSON", () => {
  const config = loadConfigFromString("not json");
  expect(config).toEqual(DEFAULT_CONFIG);
});

test("loadConfigFromString merges partial config", () => {
  const config = loadConfigFromString(JSON.stringify({
    layout: "compact",
    segments: { cost: { enabled: false } },
  }));
  expect(config.layout).toBe("compact");
  expect(config.segments.cost.enabled).toBe(false);
  expect(config.segments.usage.enabled).toBe(true);
});

test("loadConfigFromString ignores invalid types", () => {
  const config = loadConfigFromString(JSON.stringify({
    layout: 42,
    powerlineGlyphs: "yes",
  }));
  expect(config.layout).toBe("expanded");
  expect(config.powerlineGlyphs).toBe(false); // default is false (pipe mode)
});

test("DEFAULT_CONFIG has correct cost prices for opus", () => {
  expect(DEFAULT_CONFIG.cost.prices.opus.input).toBe(15);
  expect(DEFAULT_CONFIG.cost.prices.opus.output).toBe(75);
});

test("DEFAULT_CONFIG has theme field", () => {
  expect(DEFAULT_CONFIG.theme).toBe("default");
});
