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
  sessionStart: number | null;
  sessionName: string | null;
}

// === Config ===
export interface CockpitConfig {
  theme: string;
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
