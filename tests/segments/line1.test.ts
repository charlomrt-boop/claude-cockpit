import { describe, it, expect } from "bun:test";
import { COLORS } from "../../src/colors";
import { DEFAULT_CONFIG } from "../../src/config";
import { modelSegment } from "../../src/segments/model";
import { contextSegment } from "../../src/segments/context";
import { usageSegment } from "../../src/segments/usage";
import { costSegment } from "../../src/segments/cost";
import { durationSegment } from "../../src/segments/duration";
import { sessionSegment } from "../../src/segments/session";

const bgBlue = COLORS.blue;
const contextColors = DEFAULT_CONFIG.colors.context;
const usageColors = DEFAULT_CONFIG.colors.usage;
const prices = DEFAULT_CONFIG.cost.prices;

// ─── modelSegment ─────────────────────────────────────────────────────────────

describe("modelSegment", () => {
  it("returns label when provided", () => {
    const seg = modelSegment("Opus 4.6", bgBlue);
    expect(seg.text).toBe("Opus 4.6");
    expect(seg.bg).toBe(bgBlue);
    expect(seg.fg).toBe(COLORS.white);
  });

  it("returns 'Unknown' for empty string", () => {
    const seg = modelSegment("", bgBlue);
    expect(seg.text).toBe("Unknown");
  });

  it("returns 'Unknown' for whitespace-only string", () => {
    const seg = modelSegment("   ", bgBlue);
    expect(seg.text).toBe("Unknown");
  });
});

// ─── contextSegment ───────────────────────────────────────────────────────────

describe("contextSegment", () => {
  it("returns green bg at 30%", () => {
    const seg = contextSegment(30, contextColors);
    expect(seg.bg).toBe(contextColors.low);
    expect(seg.text).toContain("30%");
    expect(seg.fg).toBe(COLORS.white);
  });

  it("returns yellow bg at 60%", () => {
    const seg = contextSegment(60, contextColors);
    expect(seg.bg).toBe(contextColors.mid);
    expect(seg.text).toContain("60%");
  });

  it("returns red bg at 80%", () => {
    const seg = contextSegment(80, contextColors);
    expect(seg.bg).toBe(contextColors.high);
    expect(seg.text).toContain("80%");
  });

  it("returns red bg at exactly 75%", () => {
    const seg = contextSegment(75, contextColors);
    expect(seg.bg).toBe(contextColors.high);
  });

  it("returns yellow bg at exactly 50%", () => {
    const seg = contextSegment(50, contextColors);
    expect(seg.bg).toBe(contextColors.mid);
  });

  it("returns green bg below 50%", () => {
    const seg = contextSegment(49, contextColors);
    expect(seg.bg).toBe(contextColors.low);
  });

  it("contains bar characters", () => {
    const seg = contextSegment(50, contextColors);
    expect(seg.text).toMatch(/[█░]/);
  });
});

// ─── usageSegment ─────────────────────────────────────────────────────────────

describe("usageSegment", () => {
  const now = Date.now();
  const resetIn2h = Math.floor(now / 1000) + 7200; // 2h from now

  it("returns cyan bg with 5h percentage and time remaining", () => {
    const seg = usageSegment(25, resetIn2h, null, null, "auto", usageColors, now);
    expect(seg).not.toBeNull();
    expect(seg!.bg).toBe(usageColors.normal);
    expect(seg!.text).toContain("25%");
    expect(seg!.text).toContain("left");
  });

  it("returns null when both values are null", () => {
    const seg = usageSegment(null, null, null, null, "auto", usageColors, now);
    expect(seg).toBeNull();
  });

  it("returns warning bg at >= 80%", () => {
    const seg = usageSegment(85, null, null, null, "auto", usageColors, now);
    expect(seg).not.toBeNull();
    expect(seg!.bg).toBe(usageColors.warning);
  });

  it("shows 7d when showSevenDay is always", () => {
    const seg = usageSegment(25, null, 40, resetIn2h, "always", usageColors, now);
    expect(seg).not.toBeNull();
    expect(seg!.text).toContain("7d: 40%");
    expect(seg!.text).toContain("left");
  });

  it("shows 7d in auto mode when sevenDayPct is provided", () => {
    const seg = usageSegment(25, null, 40, null, "auto", usageColors, now);
    expect(seg).not.toBeNull();
    expect(seg!.text).toContain("7d: 40%");
  });

  it("omits 7d in auto mode when sevenDayPct is null", () => {
    const seg = usageSegment(25, null, null, null, "auto", usageColors, now);
    expect(seg).not.toBeNull();
    expect(seg!.text).not.toContain("7d:");
  });

  it("omits 7d when showSevenDay is never", () => {
    const seg = usageSegment(25, null, 40, null, "never", usageColors, now);
    expect(seg).not.toBeNull();
    expect(seg!.text).not.toContain("7d:");
  });

  it("uses warning bg when 7d pct is >= 80 even if 5h is low", () => {
    const seg = usageSegment(10, null, 82, null, "always", usageColors, now);
    expect(seg).not.toBeNull();
    expect(seg!.bg).toBe(usageColors.warning);
  });
});

// ─── costSegment ──────────────────────────────────────────────────────────────

describe("costSegment", () => {
  const tokens = { input: 100_000, output: 5_000, cacheRead: 0, cacheWrite: 0 };
  const bgMagenta = DEFAULT_CONFIG.colors.cost;

  it("calculates cost for opus tier", () => {
    const seg = costSegment(tokens, "opus", prices, bgMagenta);
    // input: 100000 * 15 / 1M = 1.50, output: 5000 * 75 / 1M = 0.375 → ~$1.88
    expect(seg.text).toMatch(/COST ~\$\d+\.\d{2}$/);
    expect(seg.text).not.toContain("?");
    expect(seg.fg).toBe(COLORS.white);
    expect(seg.bg).toBe(bgMagenta);
  });

  it("shows 'COST ~$?.??' when tier is null", () => {
    const seg = costSegment(tokens, null, prices, bgMagenta);
    expect(seg.text).toBe("COST ~$?.??");
  });

  it("calculates cost for sonnet tier", () => {
    const seg = costSegment(tokens, "sonnet", prices, bgMagenta);
    expect(seg.text).toMatch(/COST ~\$\d+\.\d{2}$/);
  });

  it("calculates cost for haiku tier", () => {
    const seg = costSegment(tokens, "haiku", prices, bgMagenta);
    expect(seg.text).toMatch(/COST ~\$\d+\.\d{2}$/);
  });

  it("includes cache tokens in cost calculation", () => {
    const tokensWithCache = {
      input: 10_000,
      output: 1_000,
      cacheRead: 50_000,
      cacheWrite: 5_000,
    };
    const seg = costSegment(tokensWithCache, "opus", prices, bgMagenta);
    expect(seg.text).toMatch(/COST ~\$\d+\.\d{2}$/);
  });
});

// ─── durationSegment ─────────────────────────────────────────────────────────

describe("durationSegment", () => {
  const now = Date.now();
  const bgGray = DEFAULT_CONFIG.colors.duration;

  it("shows minutes for a 5-minute session", () => {
    const start = now - 5 * 60_000;
    const seg = durationSegment(start, now, bgGray);
    expect(seg).not.toBeNull();
    expect(seg!.text).toBe("TIME 5m");
    expect(seg!.fg).toBe(COLORS.white);
    expect(seg!.bg).toBe(bgGray);
  });

  it("shows hours and minutes for a 75-minute session", () => {
    const start = now - 75 * 60_000;
    const seg = durationSegment(start, now, bgGray);
    expect(seg).not.toBeNull();
    expect(seg!.text).toBe("TIME 1h15");
  });

  it("zero-pads minutes below 10 in hour format", () => {
    const start = now - 65 * 60_000;
    const seg = durationSegment(start, now, bgGray);
    expect(seg).not.toBeNull();
    expect(seg!.text).toBe("TIME 1h05");
  });

  it("returns null when sessionStartMs is null", () => {
    const seg = durationSegment(null, now, bgGray);
    expect(seg).toBeNull();
  });

  it("shows 0m for a brand-new session", () => {
    const seg = durationSegment(now, now, bgGray);
    expect(seg).not.toBeNull();
    expect(seg!.text).toBe("TIME 0m");
  });
});

// ─── sessionSegment ───────────────────────────────────────────────────────────

describe("sessionSegment", () => {
  const bgDarkGray = DEFAULT_CONFIG.colors.session;

  it("returns segment with session name", () => {
    const seg = sessionSegment("fix-auth", bgDarkGray);
    expect(seg).not.toBeNull();
    expect(seg!.text).toBe("fix-auth");
    expect(seg!.fg).toBe(COLORS.white);
    expect(seg!.bg).toBe(bgDarkGray);
  });

  it("returns null for null name", () => {
    const seg = sessionSegment(null, bgDarkGray);
    expect(seg).toBeNull();
  });

  it("returns null for empty string", () => {
    const seg = sessionSegment("", bgDarkGray);
    expect(seg).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    const seg = sessionSegment("   ", bgDarkGray);
    expect(seg).toBeNull();
  });
});
