import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CockpitConfig } from "./types";
import { COLORS } from "./colors";

// ─── Default config ──────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: CockpitConfig = {
  theme: "default",
  layout: "expanded",
  powerlineGlyphs: true,
  segments: {
    usage: { enabled: true, showSevenDay: "auto" },
    cost: { enabled: true },
    activity: { enabled: true, maxTools: 5 },
    agents: { enabled: true },
    todos: { enabled: true },
    duration: { enabled: true },
    session: { enabled: true },
  },
  colors: {
    model: COLORS.blue,
    context: { low: COLORS.green, mid: COLORS.yellow, high: COLORS.red },
    usage: { normal: COLORS.cyan, warning: COLORS.orange },
    cost: COLORS.magenta,
    activity: COLORS.teal,
    agents: COLORS.blue,
    todos: COLORS.yellow,
    duration: COLORS.gray,
    session: COLORS.darkGray,
  },
  cost: {
    prices: {
      opus: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
      sonnet: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      haiku: { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeSegments(
  raw: unknown,
  defaults: CockpitConfig["segments"]
): CockpitConfig["segments"] {
  if (!isObj(raw)) return defaults;

  const result = { ...defaults };

  // usage
  if (isObj(raw.usage)) {
    const u = raw.usage;
    result.usage = {
      enabled: typeof u.enabled === "boolean" ? u.enabled : defaults.usage.enabled,
      showSevenDay:
        u.showSevenDay === "auto" || u.showSevenDay === "always" || u.showSevenDay === "never"
          ? u.showSevenDay
          : defaults.usage.showSevenDay,
    };
  }

  // cost
  if (isObj(raw.cost)) {
    const c = raw.cost;
    result.cost = {
      enabled: typeof c.enabled === "boolean" ? c.enabled : defaults.cost.enabled,
    };
  }

  // activity
  if (isObj(raw.activity)) {
    const a = raw.activity;
    result.activity = {
      enabled: typeof a.enabled === "boolean" ? a.enabled : defaults.activity.enabled,
      maxTools:
        typeof a.maxTools === "number" && Number.isInteger(a.maxTools) && a.maxTools > 0
          ? a.maxTools
          : defaults.activity.maxTools,
    };
  }

  // agents
  if (isObj(raw.agents)) {
    const ag = raw.agents;
    result.agents = {
      enabled: typeof ag.enabled === "boolean" ? ag.enabled : defaults.agents.enabled,
    };
  }

  // todos
  if (isObj(raw.todos)) {
    const t = raw.todos;
    result.todos = {
      enabled: typeof t.enabled === "boolean" ? t.enabled : defaults.todos.enabled,
    };
  }

  // duration
  if (isObj(raw.duration)) {
    const d = raw.duration;
    result.duration = {
      enabled: typeof d.enabled === "boolean" ? d.enabled : defaults.duration.enabled,
    };
  }

  // session
  if (isObj(raw.session)) {
    const s = raw.session;
    result.session = {
      enabled: typeof s.enabled === "boolean" ? s.enabled : defaults.session.enabled,
    };
  }

  return result;
}

function mergeColors(
  raw: unknown,
  defaults: CockpitConfig["colors"]
): CockpitConfig["colors"] {
  if (!isObj(raw)) return defaults;

  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 255 ? v : fallback;

  const result = { ...defaults };

  if (typeof raw.model === "number") result.model = num(raw.model, defaults.model);

  if (isObj(raw.context)) {
    result.context = {
      low: num(raw.context.low, defaults.context.low),
      mid: num(raw.context.mid, defaults.context.mid),
      high: num(raw.context.high, defaults.context.high),
    };
  }

  if (isObj(raw.usage)) {
    result.usage = {
      normal: num(raw.usage.normal, defaults.usage.normal),
      warning: num(raw.usage.warning, defaults.usage.warning),
    };
  }

  if (typeof raw.cost === "number") result.cost = num(raw.cost, defaults.cost);
  if (typeof raw.activity === "number") result.activity = num(raw.activity, defaults.activity);
  if (typeof raw.agents === "number") result.agents = num(raw.agents, defaults.agents);
  if (typeof raw.todos === "number") result.todos = num(raw.todos, defaults.todos);
  if (typeof raw.duration === "number") result.duration = num(raw.duration, defaults.duration);
  if (typeof raw.session === "number") result.session = num(raw.session, defaults.session);

  return result;
}

function mergeCost(
  raw: unknown,
  defaults: CockpitConfig["cost"]
): CockpitConfig["cost"] {
  if (!isObj(raw) || !isObj(raw.prices)) return defaults;

  const prices = { ...defaults.prices };
  const tiers = ["opus", "sonnet", "haiku"] as const;

  for (const tier of tiers) {
    const t = raw.prices[tier];
    if (!isObj(t)) continue;
    const num = (v: unknown, fb: number) => (typeof v === "number" && v >= 0 ? v : fb);
    prices[tier] = {
      input: num(t.input, defaults.prices[tier].input),
      output: num(t.output, defaults.prices[tier].output),
      cacheRead: num(t.cacheRead, defaults.prices[tier].cacheRead),
      cacheWrite: num(t.cacheWrite, defaults.prices[tier].cacheWrite),
    };
  }

  return { prices };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function loadConfigFromString(raw: string): CockpitConfig {
  if (!raw.trim()) return { ...DEFAULT_CONFIG };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.stderr.write("[claude-cockpit] config: invalid JSON, using defaults\n");
    return { ...DEFAULT_CONFIG };
  }

  if (!isObj(parsed)) {
    process.stderr.write("[claude-cockpit] config: root must be an object, using defaults\n");
    return { ...DEFAULT_CONFIG };
  }

  const config: CockpitConfig = {
    theme:
      typeof parsed.theme === "string" && parsed.theme.length > 0
        ? parsed.theme
        : DEFAULT_CONFIG.theme,

    layout:
      parsed.layout === "expanded" || parsed.layout === "compact"
        ? parsed.layout
        : (() => {
            if (parsed.layout !== undefined) {
              process.stderr.write(
                `[claude-cockpit] config: invalid layout "${parsed.layout}", using default\n`
              );
            }
            return DEFAULT_CONFIG.layout;
          })(),

    powerlineGlyphs:
      typeof parsed.powerlineGlyphs === "boolean"
        ? parsed.powerlineGlyphs
        : (() => {
            if (parsed.powerlineGlyphs !== undefined) {
              process.stderr.write(
                `[claude-cockpit] config: powerlineGlyphs must be boolean, using default\n`
              );
            }
            return DEFAULT_CONFIG.powerlineGlyphs;
          })(),

    segments: mergeSegments(parsed.segments, DEFAULT_CONFIG.segments),
    colors: mergeColors(parsed.colors, DEFAULT_CONFIG.colors),
    cost: mergeCost(parsed.cost, DEFAULT_CONFIG.cost),
  };

  return config;
}

export function loadConfig(): CockpitConfig {
  const configPath = join(
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
    // File not found or unreadable — silently use defaults
    return { ...DEFAULT_CONFIG };
  }
}
