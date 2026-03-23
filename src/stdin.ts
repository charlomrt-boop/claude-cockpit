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
  const match = displayName.match(/(Opus|Sonnet|Haiku)\s*[\d.]+/i);
  if (match) return match[0];
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
