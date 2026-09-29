import { mkdirSync, writeFileSync, renameSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import type { StdinData } from "./types";

// Dernier état des quotas de l'abonnement Claude, lu par l'Appli Hermes (via SSH depuis le VPS).
export const USAGE_FILE = join(homedir(), ".claude", "plugins", "claude-cockpit", "cache", "etat-usage.json");

export function usageSnapshot(stdin: StdinData, now: number) {
  const rl = stdin.rate_limits;
  if (!rl?.five_hour && !rl?.seven_day) return null;
  const win = (w?: { used_percentage?: number | null; resets_at?: string | number | null }) =>
    w ? { pourcent: w.used_percentage ?? null, reinitialisation: w.resets_at ?? null } : null;
  return { mesure: Math.floor(now / 1000), modele: stdin.model?.id ?? null, cinq_heures: win(rl.five_hour), sept_jours: win(rl.seven_day) };
}

export function writeUsage(stdin: StdinData, now: number, file = USAGE_FILE): void {
  const snap = usageSnapshot(stdin, now);
  if (!snap) return;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file + ".tmp", JSON.stringify(snap));
    renameSync(file + ".tmp", file);
  } catch {
    // jamais bloquant pour la statusLine
  }
}
