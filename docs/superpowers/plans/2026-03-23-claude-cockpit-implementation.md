# claude-cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Starship-style statusLine plugin for Claude Code with powerline segments, cost tracking, and incremental transcript parsing.

**Architecture:** Single-invocation CLI tool. Claude Code pipes JSON on stdin, we parse it + the transcript JSONL, compute segments (pure functions), assemble with powerline glyphs, output ANSI text to stdout. Zero runtime deps, single bundled JS file via `bun build`.

**Tech Stack:** TypeScript, Bun runtime, Bun test runner, zero runtime dependencies

**Spec:** `docs/design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/types.ts` | StdinData interface, Segment type, Config type, TranscriptData type |
| `src/colors.ts` | ANSI 256 color codes, fg/bg helpers, powerline glyph constants |
| `src/stdin.ts` | Read stdin JSON, parse to StdinData, extract model tier |
| `src/config.ts` | Load config.json, validate with defaults, merge |
| `src/segments/model.ts` | Model name segment |
| `src/segments/context.ts` | Context bar with color gradient |
| `src/segments/usage.ts` | Rate limit quota segment |
| `src/segments/cost.ts` | Cost estimation segment |
| `src/segments/duration.ts` | Session duration segment |
| `src/segments/session.ts` | Session name segment |
| `src/segments/activity.ts` | Tool activity segment |
| `src/segments/agents.ts` | Agent status segment |
| `src/segments/todos.ts` | Todo progress segment |
| `src/transcript.ts` | Incremental JSONL parser with file cache |
| `src/renderer.ts` | Assemble segments into powerline ANSI lines |
| `src/index.ts` | Entry point, main() with DI, orchestration |
| `commands/configure.md` | Interactive configure skill prompt |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Modify: `.gitignore` (add test coverage)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "claude-cockpit",
  "version": "0.1.0",
  "description": "Starship-style statusLine plugin for Claude Code",
  "main": "src/index.ts",
  "scripts": {
    "start": "bun run src/index.ts",
    "build": "bun build src/index.ts --target=bun --outfile=dist/cockpit.js",
    "test": "bun test",
    "test:watch": "bun test --watch"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "bun-types": "latest",
    "typescript": "^5.7.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["bun-types"],
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd claude-cockpit && bun install`
Expected: lockfile created, node_modules populated

- [ ] **Step 4: Verify bun test works**

Create `tests/smoke.test.ts`:
```typescript
import { test, expect } from "bun:test";

test("smoke test", () => {
  expect(1 + 1).toBe(2);
});
```

Run: `bun test`
Expected: 1 test passed

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json bun.lock tests/smoke.test.ts
git commit -m "chore: scaffold project with Bun + TypeScript"
```

---

### Task 2: Types & Colors

**Files:**
- Create: `src/types.ts`
- Create: `src/colors.ts`
- Create: `tests/colors.test.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// === Stdin API contract ===
export interface StdinData {
  model: { id: string; display_name: string };
  session_id: string;
  cwd: string;
  transcript_path: string;
  context_window: {
    context_window_size: number;
    used_percentage?: number;
    remaining_percentage?: number;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_tokens: number;
      cache_read_tokens: number;
    };
  };
  rate_limits?: {
    five_hour?: { used_percentage: number; resets_at: number };
    seven_day?: { used_percentage: number; resets_at: number };
  };
}

// === Segment output ===
export interface Segment {
  text: string;
  fg: number;    // ANSI 256 foreground
  bg: number;    // ANSI 256 background
  icon?: string; // optional prefix icon
}

// === Model tier for cost lookup ===
export type ModelTier = "opus" | "sonnet" | "haiku";

// === Transcript parsed data ===
export interface ToolEntry {
  id: string;
  name: string;
  status: "running" | "completed" | "error";
}

export interface AgentEntry {
  id: string;
  name: string;
  model?: string;
  status: "running" | "completed" | "error";
  description?: string;
}

export interface TodoEntry {
  id: string;
  subject: string;
  status: "pending" | "in_progress" | "completed";
}

export interface TranscriptData {
  tools: ToolEntry[];
  agents: AgentEntry[];
  todos: TodoEntry[];
  sessionStart: number | null;  // unix ms timestamp
  sessionName: string | null;
}

// === Config ===
export interface CockpitConfig {
  theme: string; // reserved, currently only "default"
  layout: "expanded" | "compact";
  powerlineGlyphs: boolean;
  segments: {
    // model and context are always on (not configurable)
    usage: { enabled: boolean; showSevenDay: "auto" | "always" | "never" };
    cost: { enabled: boolean };
    activity: { enabled: boolean; maxTools: number };
    agents: { enabled: boolean };
    todos: { enabled: boolean };
    duration: { enabled: boolean };
    session: { enabled: boolean };
  };
  colors: {
    model: number;
    context: { low: number; mid: number; high: number };
    usage: { normal: number; warning: number };
    cost: number;
    activity: number;
    agents: number;
    todos: number;
    duration: number;
    session: number;
  };
  cost: {
    prices: Record<ModelTier, {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
    }>;
  };
}
```

- [ ] **Step 2: Write failing test for colors**

Create `tests/colors.test.ts`:
```typescript
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
```

Run: `bun test tests/colors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement colors.ts**

```typescript
export const POWERLINE_RIGHT = "\uE0B0";
export const POWERLINE_RIGHT_ASCII = ">";

export function fg(color: number): string {
  return `\x1b[38;5;${color}m`;
}

export function bg(color: number): string {
  return `\x1b[48;5;${color}m`;
}

export function reset(): string {
  return "\x1b[0m";
}

export function segment(text: string, fgColor: number, bgColor: number): string {
  return `${fg(fgColor)}${bg(bgColor)} ${text} `;
}

// Named color constants (ANSI 256)
export const COLORS = {
  blue: 33,
  green: 34,
  yellow: 220,
  red: 196,
  cyan: 44,
  magenta: 129,
  gray: 245,
  darkGray: 240,
  orange: 208,
  teal: 30,
  white: 255,
  black: 0,
} as const;
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bun test tests/colors.test.ts`
Expected: 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/colors.ts tests/colors.test.ts
git commit -m "feat: add shared types and ANSI color helpers"
```

---

### Task 3: Stdin Parser

**Files:**
- Create: `src/stdin.ts`
- Create: `tests/stdin.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
  const data = { ...MOCK_STDIN };
  expect(getContextPercent(data)).toBe(42);
});

test("getContextPercent falls back to manual calculation", () => {
  const data = {
    ...MOCK_STDIN,
    context_window: {
      ...MOCK_STDIN.context_window,
      used_percentage: undefined,
    },
  };
  // (50000+10000+5000+20000) / 200000 * 100 = 42.5
  expect(getContextPercent(data)).toBeCloseTo(42.5, 1);
});
```

Run: `bun test tests/stdin.test.ts`
Expected: FAIL — module not found

- [ ] **Step 2: Implement stdin.ts**

```typescript
import type { StdinData, ModelTier } from "./types";

export function parseStdin(raw: string): StdinData | null {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as StdinData;
  } catch {
    return null;
  }
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export function getModelTier(modelId: string): ModelTier | null {
  const id = modelId.toLowerCase();
  if (id.includes("opus")) return "opus";
  if (id.includes("sonnet")) return "sonnet";
  if (id.includes("haiku")) return "haiku";
  return null;
}

export function getModelLabel(displayName: string, modelId: string): string {
  // Extract short name: "Claude Opus 4.6 (1M context)" -> "Opus 4.6"
  const match = displayName.match(/(Opus|Sonnet|Haiku)\s*[\d.]+/i);
  if (match) return match[0];
  // Fallback: try from model ID
  const tier = getModelTier(modelId);
  if (tier) return tier.charAt(0).toUpperCase() + tier.slice(1);
  return "Unknown";
}

export function getContextPercent(data: StdinData): number {
  if (typeof data.context_window.used_percentage === "number") {
    return data.context_window.used_percentage;
  }
  const usage = data.context_window.current_usage;
  const total =
    usage.input_tokens +
    usage.output_tokens +
    usage.cache_creation_tokens +
    usage.cache_read_tokens;
  const size = data.context_window.context_window_size;
  if (size === 0) return 0;
  return (total / size) * 100;
}
```

- [ ] **Step 3: Run tests, verify pass**

Run: `bun test tests/stdin.test.ts`
Expected: all tests passed

- [ ] **Step 4: Commit**

```bash
git add src/stdin.ts tests/stdin.test.ts
git commit -m "feat: add stdin parser with model tier detection"
```

---

### Task 4: Config Loader

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
  expect(config.segments.model.enabled).toBe(true); // default preserved
});

test("loadConfigFromString ignores invalid types", () => {
  const config = loadConfigFromString(JSON.stringify({
    layout: 42, // wrong type
    powerlineGlyphs: "yes", // wrong type
  }));
  expect(config.layout).toBe("expanded"); // default
  expect(config.powerlineGlyphs).toBe(true); // default
});

test("DEFAULT_CONFIG has correct cost prices for opus", () => {
  expect(DEFAULT_CONFIG.cost.prices.opus.input).toBe(15);
  expect(DEFAULT_CONFIG.cost.prices.opus.output).toBe(75);
});
```

Run: `bun test tests/config.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement config.ts**

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { CockpitConfig } from "./types";
import { COLORS } from "./colors";

export const DEFAULT_CONFIG: CockpitConfig = {
  theme: "default",
  layout: "expanded",
  powerlineGlyphs: true,
  segments: {
    usage: { enabled: true, showSevenDay: "auto" },
    cost: { enabled: true },
    activity: { enabled: true, maxTools: 20 },
    agents: { enabled: true },
    todos: { enabled: true },
    duration: { enabled: true },
    session: { enabled: true },
  },
  colors: {
    model: COLORS.blue,
    context: { low: COLORS.green, mid: COLORS.yellow, high: COLORS.red },
    usage: { normal: COLORS.cyan, warning: COLORS.red },
    cost: COLORS.magenta,
    activity: COLORS.gray,
    agents: COLORS.orange,
    todos: COLORS.green,
    duration: COLORS.darkGray,
    session: COLORS.teal,
  },
  cost: {
    prices: {
      opus: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
      sonnet: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      haiku: { input: 0.25, output: 1.25, cacheRead: 0.025, cacheWrite: 0.3 },
    },
  },
};

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeSegments(
  defaults: CockpitConfig["segments"],
  input: unknown
): CockpitConfig["segments"] {
  if (!isObj(input)) return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    if (!isObj(input[key])) continue;
    const seg = input[key] as Record<string, unknown>;
    result[key] = { ...defaults[key] } as any;
    if (typeof seg.enabled === "boolean") (result[key] as any).enabled = seg.enabled;
    if ("showSevenDay" in seg && typeof seg.showSevenDay === "string") {
      (result[key] as any).showSevenDay = seg.showSevenDay;
    }
    if ("maxTools" in seg && typeof seg.maxTools === "number") {
      (result[key] as any).maxTools = seg.maxTools;
    }
  }
  return result;
}

export function loadConfigFromString(raw: string): CockpitConfig {
  if (!raw || !raw.trim()) return { ...DEFAULT_CONFIG };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
  if (!isObj(parsed)) return { ...DEFAULT_CONFIG };

  const config: CockpitConfig = {
    layout:
      parsed.layout === "expanded" || parsed.layout === "compact"
        ? parsed.layout
        : DEFAULT_CONFIG.layout,
    powerlineGlyphs:
      typeof parsed.powerlineGlyphs === "boolean"
        ? parsed.powerlineGlyphs
        : DEFAULT_CONFIG.powerlineGlyphs,
    segments: mergeSegments(DEFAULT_CONFIG.segments, parsed.segments),
    colors: isObj(parsed.colors)
      ? mergeColors(DEFAULT_CONFIG.colors, parsed.colors)
      : { ...DEFAULT_CONFIG.colors },
    cost: isObj(parsed.cost)
      ? mergeCost(DEFAULT_CONFIG.cost, parsed.cost)
      : { ...DEFAULT_CONFIG.cost },
  };
  return config;
}

function mergeColors(
  defaults: CockpitConfig["colors"],
  input: Record<string, unknown>
): CockpitConfig["colors"] {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const val = input[key];
    if (typeof val === "number") (result as any)[key] = val;
    if (isObj(val) && isObj(defaults[key])) {
      (result as any)[key] = { ...(defaults[key] as object) };
      for (const sub of Object.keys(defaults[key] as object)) {
        if (typeof (val as any)[sub] === "number") {
          ((result as any)[key] as any)[sub] = (val as any)[sub];
        }
      }
    }
  }
  return result;
}

function mergeCost(
  defaults: CockpitConfig["cost"],
  input: Record<string, unknown>
): CockpitConfig["cost"] {
  if (!isObj(input.prices)) return { ...defaults };
  const result = { prices: { ...defaults.prices } };
  for (const tier of ["opus", "sonnet", "haiku"] as const) {
    if (!isObj((input.prices as any)[tier])) continue;
    const p = (input.prices as any)[tier] as Record<string, unknown>;
    result.prices[tier] = { ...defaults.prices[tier] };
    for (const field of ["input", "output", "cacheRead", "cacheWrite"] as const) {
      if (typeof p[field] === "number") result.prices[tier][field] = p[field] as number;
    }
  }
  return result;
}

export function loadConfig(): CockpitConfig {
  const configPath = resolve(
    homedir(),
    ".claude",
    "plugins",
    "claude-cockpit",
    "config.json"
  );
  try {
    const raw = readFileSync(configPath, "utf-8");
    return loadConfigFromString(raw);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
```

- [ ] **Step 3: Run tests, verify pass**

Run: `bun test tests/config.test.ts`
Expected: all tests passed

- [ ] **Step 4: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: add config loader with hand-written validation"
```

---

### Task 5: Line 1 Segments (model, context, usage, cost, duration, session)

**Files:**
- Create: `src/segments/model.ts`
- Create: `src/segments/context.ts`
- Create: `src/segments/usage.ts`
- Create: `src/segments/cost.ts`
- Create: `src/segments/duration.ts`
- Create: `src/segments/session.ts`
- Create: `tests/segments/line1.test.ts`

- [ ] **Step 1: Write failing tests for all 6 segments**

```typescript
import { test, expect } from "bun:test";
import { modelSegment } from "../../src/segments/model";
import { contextSegment } from "../../src/segments/context";
import { usageSegment } from "../../src/segments/usage";
import { costSegment } from "../../src/segments/cost";
import { durationSegment } from "../../src/segments/duration";
import { sessionSegment } from "../../src/segments/session";
import { COLORS } from "../../src/colors";
import { DEFAULT_CONFIG } from "../../src/config";

// === Model ===
test("modelSegment shows model label", () => {
  const seg = modelSegment("Opus 4.6", DEFAULT_CONFIG.colors.model);
  expect(seg.text).toBe("Opus 4.6");
  expect(seg.bg).toBe(COLORS.blue);
});

test("modelSegment shows Unknown for empty", () => {
  const seg = modelSegment("", DEFAULT_CONFIG.colors.model);
  expect(seg.text).toBe("Unknown");
});

// === Context ===
test("contextSegment shows green bar at 30%", () => {
  const seg = contextSegment(30, DEFAULT_CONFIG.colors.context);
  expect(seg.text).toContain("30%");
  expect(seg.bg).toBe(COLORS.green);
});

test("contextSegment shows yellow bar at 60%", () => {
  const seg = contextSegment(60, DEFAULT_CONFIG.colors.context);
  expect(seg.bg).toBe(COLORS.yellow);
});

test("contextSegment shows red bar at 80%", () => {
  const seg = contextSegment(80, DEFAULT_CONFIG.colors.context);
  expect(seg.bg).toBe(COLORS.red);
});

// === Usage ===
test("usageSegment shows percentage", () => {
  const seg = usageSegment(25, null, "auto", DEFAULT_CONFIG.colors.usage);
  expect(seg).not.toBeNull();
  expect(seg!.text).toContain("25%");
  expect(seg!.bg).toBe(COLORS.cyan);
});

test("usageSegment returns null when no data", () => {
  const seg = usageSegment(null, null, "auto", DEFAULT_CONFIG.colors.usage);
  expect(seg).toBeNull();
});

test("usageSegment shows red at 85%", () => {
  const seg = usageSegment(85, null, "auto", DEFAULT_CONFIG.colors.usage);
  expect(seg!.bg).toBe(COLORS.red);
});

// === Cost ===
test("costSegment calculates opus cost", () => {
  const seg = costSegment(
    { input: 50000, output: 10000, cacheRead: 20000, cacheWrite: 5000 },
    "opus",
    DEFAULT_CONFIG.cost.prices
  );
  expect(seg).not.toBeNull();
  expect(seg!.text).toMatch(/~\$\d+\.\d{2}/);
});

test("costSegment returns null-tier indicator for unknown model", () => {
  const seg = costSegment(
    { input: 50000, output: 10000, cacheRead: 20000, cacheWrite: 5000 },
    null,
    DEFAULT_CONFIG.cost.prices
  );
  expect(seg!.text).toContain("?");
});

// === Duration ===
test("durationSegment formats minutes", () => {
  const now = Date.now();
  const start = now - 5 * 60 * 1000; // 5 minutes ago
  const seg = durationSegment(start, now, COLORS.darkGray);
  expect(seg).not.toBeNull();
  expect(seg!.text).toBe("5m");
});

test("durationSegment formats hours+minutes", () => {
  const now = Date.now();
  const start = now - 75 * 60 * 1000; // 1h15m ago
  const seg = durationSegment(start, now, COLORS.darkGray);
  expect(seg!.text).toBe("1h15");
});

test("durationSegment returns null when no start", () => {
  const seg = durationSegment(null, Date.now(), COLORS.darkGray);
  expect(seg).toBeNull();
});

// === Session ===
test("sessionSegment shows name", () => {
  const seg = sessionSegment("fix-auth", COLORS.teal);
  expect(seg).not.toBeNull();
  expect(seg!.text).toBe("fix-auth");
});

test("sessionSegment returns null when no name", () => {
  expect(sessionSegment(null, COLORS.teal)).toBeNull();
  expect(sessionSegment("", COLORS.teal)).toBeNull();
});
```

Run: `bun test tests/segments/line1.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement all 6 segment files**

`src/segments/model.ts`:
```typescript
import type { Segment } from "../types";
import { COLORS } from "../colors";

export function modelSegment(label: string, bgColor: number): Segment {
  return {
    text: label || "Unknown",
    fg: COLORS.white,
    bg: bgColor,
  };
}
```

`src/segments/context.ts`:
```typescript
import type { Segment } from "../types";
import { COLORS } from "../colors";

export function contextSegment(
  percent: number,
  colors: { low: number; mid: number; high: number }
): Segment {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round(clamped / 10);
  const empty = 10 - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);

  let bgColor: number;
  if (clamped < 50) bgColor = colors.low;
  else if (clamped < 75) bgColor = colors.mid;
  else bgColor = colors.high;

  return {
    text: `${bar} ${clamped}%`,
    fg: COLORS.white,
    bg: bgColor,
  };
}
```

`src/segments/usage.ts`:
```typescript
import type { Segment } from "../types";
import { COLORS } from "../colors";

export function usageSegment(
  fiveHourPct: number | null,
  sevenDayPct: number | null,
  showSevenDay: "auto" | "always" | "never",
  colors: { normal: number; warning: number }
): Segment | null {
  if (fiveHourPct === null && sevenDayPct === null) return null;

  const parts: string[] = [];
  if (fiveHourPct !== null) parts.push(`5h: ${Math.round(fiveHourPct)}%`);

  const showSeven =
    showSevenDay === "always" ||
    (showSevenDay === "auto" && sevenDayPct !== null && sevenDayPct >= 80);
  if (showSeven && sevenDayPct !== null) {
    parts.push(`7d: ${Math.round(sevenDayPct)}%`);
  }

  const isWarning = (fiveHourPct ?? 0) >= 80 || (sevenDayPct ?? 0) >= 80;

  return {
    text: parts.join(" | "),
    fg: COLORS.white,
    bg: isWarning ? colors.warning : colors.normal,
  };
}
```

`src/segments/cost.ts`:
```typescript
import type { Segment, ModelTier } from "../types";
import { COLORS } from "../colors";

interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

interface Prices {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export function costSegment(
  tokens: TokenUsage,
  tier: ModelTier | null,
  prices: Record<ModelTier, Prices>,
  bgColor: number
): Segment {
  const p = prices[tier ?? "sonnet"];
  const cost =
    (tokens.input * p.input) / 1_000_000 +
    (tokens.output * p.output) / 1_000_000 +
    (tokens.cacheRead * p.cacheRead) / 1_000_000 +
    (tokens.cacheWrite * p.cacheWrite) / 1_000_000;

  const label = tier ? `~$${cost.toFixed(2)}` : `~$${cost.toFixed(2)}?`;

  return {
    text: label,
    fg: COLORS.white,
    bg: bgColor,
    icon: "$",
  };
}
```

`src/segments/duration.ts`:
```typescript
import type { Segment } from "../types";
import { COLORS } from "../colors";

export function durationSegment(
  sessionStartMs: number | null,
  nowMs: number,
  bgColor: number
): Segment | null {
  if (sessionStartMs === null) return null;
  const diffMs = nowMs - sessionStartMs;
  if (diffMs < 0) return null;

  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const text = hours > 0 ? `${hours}h${String(minutes).padStart(2, "0")}` : `${minutes}m`;

  return { text, fg: COLORS.white, bg: bgColor };
}
```

`src/segments/session.ts`:
```typescript
import type { Segment } from "../types";
import { COLORS } from "../colors";

export function sessionSegment(
  name: string | null,
  bgColor: number
): Segment | null {
  if (!name || !name.trim()) return null;
  return { text: name.trim(), fg: COLORS.white, bg: bgColor };
}
```

- [ ] **Step 3: Run tests, verify pass**

Run: `bun test tests/segments/line1.test.ts`
Expected: all tests passed

- [ ] **Step 4: Commit**

```bash
git add src/segments/ tests/segments/
git commit -m "feat: add line 1 segments (model, context, usage, cost, duration, session)"
```

---

### Task 6: Transcript Parser

**Files:**
- Create: `src/transcript.ts`
- Create: `tests/transcript.test.ts`
- Create: `tests/fixtures/transcript.jsonl`

- [ ] **Step 1: Create test fixture**

`tests/fixtures/transcript.jsonl` — one JSON object per line:
```
{"type":"assistant","timestamp":"2026-03-23T10:00:00Z","message":{"content":[{"type":"tool_use","id":"tool_1","name":"Read","input":{"file_path":"test.ts"}}]}}
{"type":"tool_result","tool_use_id":"tool_1","content":"file contents here"}
{"type":"assistant","timestamp":"2026-03-23T10:01:00Z","message":{"content":[{"type":"tool_use","id":"tool_2","name":"Edit","input":{"file_path":"test.ts"}}]}}
{"type":"assistant","message":{"content":[{"type":"tool_use","id":"agent_1","name":"Task","input":{"description":"Find code","model":"haiku"}}]}}
{"type":"tool_result","tool_use_id":"agent_1","content":"found it"}
{"type":"custom-title","title":"fix-auth-bug"}
```

- [ ] **Step 2: Write failing tests**

```typescript
import { test, expect } from "bun:test";
import { parseTranscriptLines } from "../src/transcript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixture = readFileSync(
  resolve(__dirname, "fixtures/transcript.jsonl"),
  "utf-8"
);
const lines = fixture.trim().split("\n");

test("parseTranscriptLines extracts tools", () => {
  const data = parseTranscriptLines(lines);
  expect(data.tools.length).toBeGreaterThanOrEqual(2);
  expect(data.tools[0].name).toBe("Read");
  expect(data.tools[0].status).toBe("completed");
  expect(data.tools[1].name).toBe("Edit");
  expect(data.tools[1].status).toBe("running"); // no tool_result yet
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
```

Run: `bun test tests/transcript.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement transcript.ts**

```typescript
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { TranscriptData, ToolEntry, AgentEntry, TodoEntry } from "./types";

const MAX_TOOLS = 20;
const MAX_AGENTS = 10;

export function parseTranscriptLines(lines: string[]): TranscriptData {
  const tools: ToolEntry[] = [];
  const agents: AgentEntry[] = [];
  let todos: TodoEntry[] = [];
  let sessionStart: number | null = null;
  let sessionName: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    // Session start from first timestamp
    if (!sessionStart && entry.timestamp) {
      const ts = new Date(entry.timestamp).getTime();
      if (!isNaN(ts)) sessionStart = ts;
    }

    // Session name
    if (entry.type === "custom-title" && entry.title) {
      sessionName = entry.title;
    }
    if (entry.slug && !sessionName) {
      sessionName = entry.slug;
    }

    // Tool use
    if (entry.type === "assistant" && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === "tool_use") {
          if (block.name === "Task") {
            agents.push({
              id: block.id,
              name: block.input?.description || "agent",
              model: block.input?.model,
              status: "running",
            });
          } else if (block.name === "TodoWrite" && Array.isArray(block.input?.todos)) {
            todos = block.input.todos.map((t: any) => ({
              id: t.id || "",
              subject: t.subject || t.content || "",
              status: t.status || "pending",
            }));
          } else if (block.name === "TaskCreate" && block.input?.subject) {
            todos.push({
              id: block.id,
              subject: block.input.subject,
              status: "pending",
            });
          } else if (block.name === "TaskUpdate" && block.input?.taskId) {
            const existing = todos.find((t) => t.id === block.input.taskId);
            if (existing && block.input.status) {
              existing.status = block.input.status;
            }
          } else {
            tools.push({
              id: block.id,
              name: block.name,
              status: "running",
            });
          }
        }
      }
    }

    // Tool result
    if (entry.type === "tool_result" && entry.tool_use_id) {
      const tool = tools.find((t) => t.id === entry.tool_use_id);
      if (tool) {
        tool.status = entry.is_error ? "error" : "completed";
      }
      const agent = agents.find((a) => a.id === entry.tool_use_id);
      if (agent) {
        agent.status = entry.is_error ? "error" : "completed";
      }
    }
  }

  return {
    tools: tools.slice(-MAX_TOOLS),
    agents: agents.slice(-MAX_AGENTS),
    todos,
    sessionStart,
    sessionName,
  };
}

interface CacheEntry {
  mtime: number;
  size: number;
  offset: number;
  data: TranscriptData;
}

const CACHE_DIR = resolve(homedir(), ".claude", "plugins", "claude-cockpit", "cache");

function getCachePath(transcriptPath: string): string {
  // Simple hash using string code points
  let hash = 0;
  for (let i = 0; i < transcriptPath.length; i++) {
    hash = ((hash << 5) - hash + transcriptPath.charCodeAt(i)) | 0;
  }
  return resolve(CACHE_DIR, `${Math.abs(hash).toString(36)}.json`);
}

export async function parseTranscript(transcriptPath: string): Promise<TranscriptData> {
  if (!transcriptPath) {
    return { tools: [], agents: [], todos: [], sessionStart: null, sessionName: null };
  }

  const resolvedPath = resolve(transcriptPath);
  let stat;
  try {
    stat = statSync(resolvedPath);
  } catch {
    return { tools: [], agents: [], todos: [], sessionStart: null, sessionName: null };
  }

  const cachePath = getCachePath(resolvedPath);
  let cache: CacheEntry | null = null;
  try {
    cache = JSON.parse(readFileSync(cachePath, "utf-8"));
  } catch {}

  let lines: string[];
  let newOffset: number;

  if (cache && cache.mtime === stat.mtimeMs && cache.size === stat.size) {
    // No changes
    return cache.data;
  }

  const content = readFileSync(resolvedPath, "utf-8");

  if (cache && stat.size >= cache.size && cache.offset > 0) {
    // Incremental: read from offset
    const newContent = content.slice(cache.offset);
    // If previous read ended mid-line, skip to next complete line
    let safeContent = newContent;
    if (cache.offset > 0 && content[cache.offset - 1] !== "\n") {
      const firstNewline = newContent.indexOf("\n");
      safeContent = firstNewline >= 0 ? newContent.slice(firstNewline + 1) : "";
    }
    lines = safeContent.trim().split("\n").filter(Boolean);
    const incrementalData = parseTranscriptLines(lines);

    // Merge with cached data
    const merged = mergeTranscriptData(cache.data, incrementalData);
    newOffset = content.length;

    try {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(
        cachePath,
        JSON.stringify({ mtime: stat.mtimeMs, size: stat.size, offset: newOffset, data: merged })
      );
    } catch {}

    return merged;
  }

  // Full parse (first run or compaction detected)
  lines = content.trim().split("\n").filter(Boolean);
  const data = parseTranscriptLines(lines);
  newOffset = content.length;

  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({ mtime: stat.mtimeMs, size: stat.size, offset: newOffset, data })
    );
  } catch {}

  return data;
}

function mergeTranscriptData(cached: TranscriptData, incremental: TranscriptData): TranscriptData {
  // Merge tools: update existing by ID, append new
  const toolMap = new Map(cached.tools.map((t) => [t.id, t]));
  for (const t of incremental.tools) toolMap.set(t.id, t);

  // Also update cached tools whose IDs appear as completed in incremental tool_results
  const agentMap = new Map(cached.agents.map((a) => [a.id, a]));
  for (const a of incremental.agents) agentMap.set(a.id, a);

  return {
    tools: [...toolMap.values()].slice(-MAX_TOOLS),
    agents: [...agentMap.values()].slice(-MAX_AGENTS),
    todos: incremental.todos.length > 0 ? incremental.todos : cached.todos,
    sessionStart: cached.sessionStart ?? incremental.sessionStart,
    sessionName: incremental.sessionName ?? cached.sessionName,
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bun test tests/transcript.test.ts`
Expected: all tests passed

- [ ] **Step 5: Commit**

```bash
git add src/transcript.ts tests/transcript.test.ts tests/fixtures/
git commit -m "feat: add incremental transcript parser with cache"
```

---

### Task 7: Line 2 Segments (activity, agents, todos)

**Files:**
- Create: `src/segments/activity.ts`
- Create: `src/segments/agents.ts`
- Create: `src/segments/todos.ts`
- Create: `tests/segments/line2.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { test, expect } from "bun:test";
import { activitySegment } from "../../src/segments/activity";
import { agentsSegment } from "../../src/segments/agents";
import { todosSegment } from "../../src/segments/todos";
import { COLORS } from "../../src/colors";
import type { ToolEntry, AgentEntry, TodoEntry } from "../../src/types";

// === Activity ===
test("activitySegment shows last tool with counts", () => {
  const tools: ToolEntry[] = [
    { id: "1", name: "Read", status: "completed" },
    { id: "2", name: "Read", status: "completed" },
    { id: "3", name: "Edit", status: "running" },
  ];
  const seg = activitySegment(tools, COLORS.gray);
  expect(seg).not.toBeNull();
  expect(seg!.text).toContain("Edit");
  expect(seg!.icon).toBe("\u25D0"); // ◐ running
});

test("activitySegment returns null for empty tools", () => {
  expect(activitySegment([], COLORS.gray)).toBeNull();
});

// === Agents ===
test("agentsSegment shows running agent", () => {
  const agents: AgentEntry[] = [
    { id: "1", name: "Find code", status: "running" },
  ];
  const seg = agentsSegment(agents, COLORS.orange);
  expect(seg).not.toBeNull();
  expect(seg!.text).toContain("Find code");
});

test("agentsSegment returns null for empty", () => {
  expect(agentsSegment([], COLORS.orange)).toBeNull();
});

// === Todos ===
test("todosSegment shows completion count", () => {
  const todos: TodoEntry[] = [
    { id: "1", subject: "A", status: "completed" },
    { id: "2", subject: "B", status: "in_progress" },
    { id: "3", subject: "C", status: "pending" },
  ];
  const seg = todosSegment(todos, COLORS.green);
  expect(seg).not.toBeNull();
  expect(seg!.text).toBe("1/3");
  expect(seg!.icon).toBe("\u25B8"); // ▸
});

test("todosSegment returns null for empty", () => {
  expect(todosSegment([], COLORS.green)).toBeNull();
});
```

Run: `bun test tests/segments/line2.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement all 3 segment files**

`src/segments/activity.ts`:
```typescript
import type { Segment, ToolEntry } from "../types";
import { COLORS } from "../colors";

const STATUS_ICONS: Record<string, string> = {
  running: "\u25D0",   // ◐
  completed: "\u2713", // ✓
  error: "\u2717",     // ✗
};

export function activitySegment(
  tools: ToolEntry[],
  bgColor: number
): Segment | null {
  if (tools.length === 0) return null;

  const last = tools[tools.length - 1];
  const counts = new Map<string, number>();
  for (const t of tools) {
    if (t.status === "completed") {
      counts.set(t.name, (counts.get(t.name) || 0) + 1);
    }
  }

  const parts: string[] = [];
  if (last.status === "running") {
    parts.push(`${last.name}`);
  }
  for (const [name, count] of counts) {
    if (name === last.name && last.status === "running") continue;
    parts.push(`${name} x${count}`);
  }

  return {
    text: parts.join(" | "),
    fg: COLORS.white,
    bg: bgColor,
    icon: STATUS_ICONS[last.status] || STATUS_ICONS.running,
  };
}
```

`src/segments/agents.ts`:
```typescript
import type { Segment, AgentEntry } from "../types";
import { COLORS } from "../colors";

export function agentsSegment(
  agents: AgentEntry[],
  bgColor: number
): Segment | null {
  if (agents.length === 0) return null;

  const last = agents[agents.length - 1];
  const label = last.model ? `${last.name} [${last.model}]` : last.name;

  return {
    text: label,
    fg: COLORS.white,
    bg: bgColor,
    icon: last.status === "running" ? "\u25D0" : "\u2713",
  };
}
```

`src/segments/todos.ts`:
```typescript
import type { Segment, TodoEntry } from "../types";
import { COLORS } from "../colors";

export function todosSegment(
  todos: TodoEntry[],
  bgColor: number
): Segment | null {
  if (todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;

  return {
    text: `${completed}/${total}`,
    fg: COLORS.white,
    bg: bgColor,
    icon: "\u25B8", // ▸
  };
}
```

- [ ] **Step 3: Run tests, verify pass**

Run: `bun test tests/segments/line2.test.ts`
Expected: all tests passed

- [ ] **Step 4: Commit**

```bash
git add src/segments/activity.ts src/segments/agents.ts src/segments/todos.ts tests/segments/line2.test.ts
git commit -m "feat: add line 2 segments (activity, agents, todos)"
```

---

### Task 8: Renderer

**Files:**
- Create: `src/renderer.ts`
- Create: `tests/renderer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
  expect(output).toContain("\uE0B0"); // powerline glyph
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
```

Run: `bun test tests/renderer.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement renderer.ts**

```typescript
import type { Segment } from "./types";
import { fg, bg, reset, POWERLINE_RIGHT, POWERLINE_RIGHT_ASCII } from "./colors";

export function renderLine(segments: Segment[], powerline: boolean): string {
  if (segments.length === 0) return "";

  const arrow = powerline ? POWERLINE_RIGHT : POWERLINE_RIGHT_ASCII;
  let out = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const content = seg.icon ? `${seg.icon} ${seg.text}` : seg.text;

    out += `${fg(seg.fg)}${bg(seg.bg)} ${content} `;

    // Arrow separator
    if (i < segments.length - 1) {
      const nextBg = segments[i + 1].bg;
      out += `${fg(seg.bg)}${bg(nextBg)}${arrow}`;
    } else {
      // Final arrow into terminal background
      out += `${reset()}${fg(seg.bg)}${arrow}${reset()}`;
    }
  }

  return out;
}

export function renderHud(
  line1: Segment[],
  line2: Segment[],
  powerline: boolean,
  layout: "expanded" | "compact"
): string {
  const lines: string[] = [];

  if (layout === "compact") {
    // Merge all segments onto one line
    const all = [...line1, ...line2];
    const rendered = renderLine(all, powerline);
    if (rendered) lines.push(rendered);
  } else {
    // Expanded: separate lines
    const r1 = renderLine(line1, powerline);
    if (r1) lines.push(r1);
    const r2 = renderLine(line2, powerline);
    if (r2) lines.push(r2);
  }

  return lines.join("\n");
}
```

- [ ] **Step 3: Run tests, verify pass**

Run: `bun test tests/renderer.test.ts`
Expected: all tests passed

- [ ] **Step 4: Commit**

```bash
git add src/renderer.ts tests/renderer.test.ts
git commit -m "feat: add powerline renderer with expanded/compact layout"
```

---

### Task 9: Entry Point & Integration

**Files:**
- Create: `src/index.ts`
- Create: `tests/integration.test.ts`

- [ ] **Step 1: Write failing integration test**

```typescript
import { test, expect } from "bun:test";
import { buildHud } from "../src/index";
import { DEFAULT_CONFIG } from "../src/config";
import type { StdinData, TranscriptData } from "../src/types";

const MOCK_STDIN: StdinData = {
  model: { id: "claude-opus-4-6-20250310", display_name: "Claude Opus 4.6 (1M context)" },
  session_id: "test",
  cwd: "/tmp",
  transcript_path: "",
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

const MOCK_TRANSCRIPT: TranscriptData = {
  tools: [
    { id: "1", name: "Read", status: "completed" },
    { id: "2", name: "Edit", status: "running" },
  ],
  agents: [],
  todos: [
    { id: "t1", subject: "Fix bug", status: "completed" },
    { id: "t2", subject: "Add test", status: "pending" },
  ],
  sessionStart: Date.now() - 5 * 60 * 1000,
  sessionName: "fix-auth",
};

test("buildHud returns non-empty ANSI output", () => {
  const output = buildHud(MOCK_STDIN, MOCK_TRANSCRIPT, DEFAULT_CONFIG, Date.now());
  expect(output.length).toBeGreaterThan(0);
  expect(output).toContain("Opus 4.6");
  expect(output).toContain("42%");
});

test("buildHud includes cost segment", () => {
  const output = buildHud(MOCK_STDIN, MOCK_TRANSCRIPT, DEFAULT_CONFIG, Date.now());
  expect(output).toContain("~$");
});

test("buildHud includes activity line in expanded mode", () => {
  const output = buildHud(MOCK_STDIN, MOCK_TRANSCRIPT, DEFAULT_CONFIG, Date.now());
  expect(output).toContain("Edit");
  expect(output).toContain("1/2"); // todos
});

test("buildHud hides disabled segments", () => {
  const config = {
    ...DEFAULT_CONFIG,
    segments: { ...DEFAULT_CONFIG.segments, cost: { enabled: false } },
  };
  const output = buildHud(MOCK_STDIN, MOCK_TRANSCRIPT, config, Date.now());
  expect(output).not.toContain("~$");
});

test("buildHud handles missing stdin gracefully", () => {
  const output = buildHud(null as any, MOCK_TRANSCRIPT, DEFAULT_CONFIG, Date.now());
  expect(output).toBe("");
});
```

Run: `bun test tests/integration.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement index.ts**

```typescript
import type { StdinData, TranscriptData, CockpitConfig, Segment } from "./types";
import { readStdin, parseStdin, getModelTier, getModelLabel, getContextPercent } from "./stdin";
import { parseTranscript } from "./transcript";
import { loadConfig } from "./config";
import { renderHud } from "./renderer";
import { modelSegment } from "./segments/model";
import { contextSegment } from "./segments/context";
import { usageSegment } from "./segments/usage";
import { costSegment } from "./segments/cost";
import { durationSegment } from "./segments/duration";
import { sessionSegment } from "./segments/session";
import { activitySegment } from "./segments/activity";
import { agentsSegment } from "./segments/agents";
import { todosSegment } from "./segments/todos";

export function buildHud(
  stdin: StdinData,
  transcript: TranscriptData,
  config: CockpitConfig,
  now: number
): string {
  if (!stdin) return "";

  const tier = getModelTier(stdin.model.id);
  const label = getModelLabel(stdin.model.display_name, stdin.model.id);
  const contextPct = getContextPercent(stdin);

  // Line 1: identity & metrics
  const line1: Segment[] = [];

  line1.push(modelSegment(label, config.colors.model));
  line1.push(contextSegment(contextPct, config.colors.context));

  if (config.segments.usage.enabled) {
    const fiveH = stdin.rate_limits?.five_hour?.used_percentage ?? null;
    const sevenD = stdin.rate_limits?.seven_day?.used_percentage ?? null;
    const seg = usageSegment(fiveH, sevenD, config.segments.usage.showSevenDay, config.colors.usage);
    if (seg) line1.push(seg);
  }

  if (config.segments.cost.enabled) {
    const usage = stdin.context_window.current_usage;
    const seg = costSegment(
      {
        input: usage.input_tokens,
        output: usage.output_tokens,
        cacheRead: usage.cache_read_tokens,
        cacheWrite: usage.cache_creation_tokens,
      },
      tier,
      config.cost.prices,
      config.colors.cost
    );
    line1.push(seg);
  }

  if (config.segments.duration.enabled) {
    const seg = durationSegment(transcript.sessionStart, now, config.colors.duration);
    if (seg) line1.push(seg);
  }

  if (config.segments.session.enabled) {
    const seg = sessionSegment(transcript.sessionName, config.colors.session);
    if (seg) line1.push(seg);
  }

  // Line 2: activity
  const line2: Segment[] = [];

  if (config.segments.activity.enabled) {
    const seg = activitySegment(transcript.tools, config.colors.activity);
    if (seg) line2.push(seg);
  }

  if (config.segments.agents.enabled) {
    const seg = agentsSegment(transcript.agents, config.colors.agents);
    if (seg) line2.push(seg);
  }

  if (config.segments.todos.enabled) {
    const seg = todosSegment(transcript.todos, config.colors.todos);
    if (seg) line2.push(seg);
  }

  return renderHud(line1, line2, config.powerlineGlyphs, config.layout);
}

async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    const stdin = parseStdin(raw);

    if (!stdin) {
      console.log("[claude-cockpit] Initializing...");
      return;
    }

    const config = loadConfig();
    const transcript = await parseTranscript(stdin.transcript_path);
    const output = buildHud(stdin, transcript, config, Date.now());

    if (output) {
      process.stdout.write(output);
    }
  } catch (err) {
    console.error("[claude-cockpit] Error:", err);
  }
}

main();
```

- [ ] **Step 3: Run tests, verify pass**

Run: `bun test tests/integration.test.ts`
Expected: all tests passed

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: all tests across all files pass

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/integration.test.ts
git commit -m "feat: add entry point with DI and full HUD orchestration"
```

---

### Task 10: Build & Manual Test

**Files:**
- Modify: `package.json` (verify build script)

- [ ] **Step 1: Build the bundle**

Run: `bun build src/index.ts --target=bun --outfile=dist/cockpit.js`
Expected: `dist/cockpit.js` created, single file

- [ ] **Step 2: Test with mock stdin**

Run:
```bash
echo '{"model":{"id":"claude-opus-4-6","display_name":"Claude Opus 4.6 (1M context)"},"session_id":"test","cwd":"/tmp","transcript_path":"","context_window":{"context_window_size":200000,"used_percentage":42,"current_usage":{"input_tokens":50000,"output_tokens":10000,"cache_creation_tokens":5000,"cache_read_tokens":20000}},"rate_limits":{"five_hour":{"used_percentage":25,"resets_at":1711234567}}}' | bun dist/cockpit.js
```

Expected: Colored powerline output with "Opus 4.6", bar at 42%, cost ~$X.XX, usage 5h: 25%

- [ ] **Step 3: Test without stdin (init mode)**

Run: `bun dist/cockpit.js < /dev/null`
Expected: `[claude-cockpit] Initializing...`

- [ ] **Step 4: Commit**

`dist/` is already in `.gitignore`. The bundle is built locally by users or in CI. No need to commit it.

```bash
git add -A
git commit -m "chore: verify build works end-to-end"
```

---

### Task 11: Configure Skill

**Files:**
- Create: `commands/configure.md`

- [ ] **Step 1: Write the configure skill prompt**

Create `commands/configure.md` — a markdown file that instructs Claude to run an interactive config flow using `AskUserQuestion` and `Write`. This should follow the flow described in the spec: layout, segments, powerline, preview, confirm, save.

The skill is a Claude Code command prompt, not executable code.

- [ ] **Step 2: Commit**

```bash
git add commands/configure.md
git commit -m "feat: add /claude-cockpit:configure skill"
```

---

### Task 12: Final Polish & Push

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: all tests pass, no warnings

- [ ] **Step 2: Remove smoke test**

Delete `tests/smoke.test.ts` (no longer needed).

- [ ] **Step 3: Final commit and push**

```bash
git add -A
git commit -m "chore: remove smoke test, final cleanup"
git push origin master
```
