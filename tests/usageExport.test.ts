import { test, expect } from "bun:test";
import { readFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { usageSnapshot, writeUsage } from "../src/usageExport";

const base: any = { model: { id: "claude-opus-5-5", display_name: "Opus" }, context_window: { current_usage: {} } };

test("sans rate_limits : rien", () => {
  expect(usageSnapshot(base, 1000)).toBeNull();
});

test("écrit les deux fenêtres", () => {
  const f = join(mkdtempSync(join(tmpdir(), "ck-")), "u.json");
  writeUsage({ ...base, rate_limits: { five_hour: { used_percentage: 12, resets_at: 1790000000 }, seven_day: { used_percentage: 40, resets_at: 1790500000 } } }, 1_700_000_000_000, f);
  const j = JSON.parse(readFileSync(f, "utf-8"));
  expect(j).toEqual({ mesure: 1700000000, modele: "claude-opus-5-5", cinq_heures: { pourcent: 12, reinitialisation: 1790000000 }, sept_jours: { pourcent: 40, reinitialisation: 1790500000 } });
});
