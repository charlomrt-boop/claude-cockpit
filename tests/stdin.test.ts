import { test, expect } from "bun:test";
import { parseStdin, getModelTier, getModelLabel, getContextPercent } from "../src/stdin";

const MOCK_STDIN = {
  model: { id: "claude-opus-4-6-20250310", display_name: "Claude Opus 4.6 (1M context)" },
  session_id: "abc123",
  cwd: "/home/user/project",
  transcript_path: "/tmp/transcript.jsonl",
  context_window: {
    context_window_size: 200000,
    used_percentage: 42,
    current_usage: {
      input_tokens: 50000,
      output_tokens: 10000,
      cache_creation_tokens: 5000,
      cache_read_tokens: 20000,
    },
  },
  rate_limits: {
    five_hour: { used_percentage: 25, resets_at: 1711234567 },
  },
};

test("parseStdin parses valid JSON", () => {
  const result = parseStdin(JSON.stringify(MOCK_STDIN));
  expect(result).not.toBeNull();
  expect(result!.model.id).toBe("claude-opus-4-6-20250310");
  expect(result!.context_window.used_percentage).toBe(42);
});

test("parseStdin returns null on invalid JSON", () => {
  expect(parseStdin("not json")).toBeNull();
});

test("parseStdin returns null on empty string", () => {
  expect(parseStdin("")).toBeNull();
});

test("getModelTier detects opus", () => {
  expect(getModelTier("claude-opus-4-6-20250310")).toBe("opus");
});

test("getModelTier detects sonnet", () => {
  expect(getModelTier("claude-sonnet-4-6-20250310")).toBe("sonnet");
});

test("getModelTier detects haiku", () => {
  expect(getModelTier("claude-haiku-4-5-20251001")).toBe("haiku");
});

test("getModelTier handles bedrock IDs", () => {
  expect(getModelTier("anthropic.claude-3-opus-20240229-v1:0")).toBe("opus");
});

test("getModelTier returns null for unknown model", () => {
  expect(getModelTier("gpt-4-turbo")).toBeNull();
});

test("getModelLabel extracts short name", () => {
  expect(getModelLabel("Claude Opus 4.6 (1M context)", "claude-opus-4-6")).toBe("Opus 4.6");
  expect(getModelLabel("Claude Sonnet 4.5 v2", "claude-sonnet-4-5")).toBe("Sonnet 4.5");
  expect(getModelLabel("", "claude-haiku-4-5")).toBe("Haiku");
  expect(getModelLabel("", "gpt-4")).toBe("Unknown");
});

test("getContextPercent prefers native used_percentage", () => {
  const data = { ...MOCK_STDIN } as any;
  expect(getContextPercent(data)).toBe(42);
});

test("getContextPercent falls back to manual calculation", () => {
  const data = {
    ...MOCK_STDIN,
    context_window: {
      ...MOCK_STDIN.context_window,
      used_percentage: undefined,
    },
  } as any;
  expect(getContextPercent(data)).toBeCloseTo(42.5, 1);
});
