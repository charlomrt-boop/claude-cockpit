# claude-cockpit — Design Spec

## Overview

**claude-cockpit** is a Claude Code statusLine plugin that provides a Starship-inspired HUD with powerline-style segments. It replaces claude-hud with a cleaner architecture, better visuals, and cost tracking.

**Goals:**
- Starship-like powerline segments with colored backgrounds and arrow separators
- Cost tracking per session based on token usage
- Clean rewrite in TypeScript/Bun, zero runtime dependencies
- Publishable as a Claude Code native plugin

## Architecture

```
Claude Code stdin (JSON one-shot)
        |
        v
  stdin.ts -----> parse JSON
  transcript.ts -> parse JSONL (incremental, offset-based)
        |
        v
  Segment Engine (pure functions)
  Each segment: (data) => { text, fg, bg, icon }
        |
        v
  renderer.ts -> assemble segments + powerline glyphs + ANSI
        |
        v
  stdout (ANSI text)
```

### Key Principles

- **Zero install-time dependencies** — Bun/Node.js stdlib only, single `bun build` bundle
- **Pure functions** — each segment receives data, returns `{ text, fg, bg, icon }`. No global state, no mutations
- **Incremental transcript parsing** — store last read offset, only parse new lines
- **Config validation** — lightweight hand-written validator (no Zod runtime), clear errors, fallback to defaults

## Stdin API Contract

Claude Code sends a JSON object on stdin with this shape:

```typescript
interface StdinData {
  model: {
    id: string;           // e.g. "claude-opus-4-6-20250310"
    display_name: string; // e.g. "Claude Opus 4.6 (1M context)"
  };
  session_id: string;
  cwd: string;            // current working directory
  transcript_path: string; // path to JSONL transcript file
  context_window: {
    context_window_size: number;
    used_percentage?: number;       // native, available v2.1.6+
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
```

### Model-to-Tier Mapping

Model ID is mapped to a pricing tier via substring matching:

| Substring in `model.id` | Tier |
|--------------------------|------|
| `opus` | opus |
| `sonnet` | sonnet |
| `haiku` | haiku |

If no substring matches, the cost segment displays "?" and uses Sonnet pricing as fallback. Bedrock-style IDs (e.g. `anthropic.claude-3-opus-...`) are handled by the same substring match.

### Context Percentage

Prefer `context_window.used_percentage` (native, accurate) when available. Fallback to manual calculation: `sum(current_usage tokens) / context_window_size * 100`.

## Segments

Each segment is a visual unit with a colored background and powerline separators (U+E0B0).

### Line 1: Identity & Metrics

| Segment | Content | Icon | Background | Condition |
|---------|---------|------|-----------|-----------|
| model | Model name (Opus/Sonnet/Haiku) | none | blue | always on, not configurable |
| context | Bar ████░░░ + percentage | none | green/yellow/red by % | always on, not configurable |
| usage | 5h quota: X% (+ 7d if >80%) | none | cyan, red if >80% | configurable, default on |
| cost | ~$X.XX context cost | $ | magenta | configurable, default on |
| duration | Session time (e.g. 12m, 1h05) | none | dark gray (ANSI 240) | configurable, default on |
| session | Session name or slug | none | teal (ANSI 30) | configurable, default on, hidden if no name set |

### Line 2: Activity (only shown when active)

| Segment | Content | Icon | Background | Condition |
|---------|---------|------|-----------|-----------|
| activity | Last tool + counter (Read x3) | ◐/✓/✗ | gray (ANSI 245) | tools active |
| agents | Agent name + status | ◐ | orange (ANSI 208) | agents active |
| todos | X/Y tasks | ▸ | green (ANSI 34) | todos exist |

### Powerline Rendering

Between segments of different colors, render U+E0B0 () with fg=previous color, bg=next color. This creates the characteristic arrow effect.

Example output:
```
 Opus 4.6  ████░░░ 42%  ~$0.37  5h: 25%  12m  fix-auth
 ◐ Edit: auth.ts | ✓ Read x3  ▸ 2/5
```

### Context Bar Colors

| Usage | Color |
|-------|-------|
| 0-50% | green |
| 50-75% | yellow |
| 75-100% | red |

### Usage Colors

| Usage | Color |
|-------|-------|
| 0-80% | cyan |
| 80-100% | red |

## Cost Tracking

Cost is estimated from stdin token data:

- `context_window.current_usage.input_tokens`
- `context_window.current_usage.cache_creation_tokens`
- `context_window.current_usage.cache_read_tokens`
- `context_window.current_usage.output_tokens`

### Default Prices (per 1M tokens)

| Model | Input | Output | Cache Read | Cache Write |
|-------|-------|--------|-----------|-------------|
| Opus | $15 | $75 | $1.50 | $18.75 |
| Sonnet | $3 | $15 | $0.30 | $3.75 |
| Haiku | $0.25 | $1.25 | $0.025 | $0.30 |

Prices are configurable in config.json for when Anthropic changes pricing.

### Cost Calculation

This formula computes the estimated cost of the current context window contents, not cumulative session spend.

```
cost = (input_tokens * input_price / 1M)
     + (output_tokens * output_price / 1M)
     + (cache_read_tokens * cache_read_price / 1M)
     + (cache_creation_tokens * cache_write_price / 1M)
```

**Limitation:** stdin provides cumulative context window usage, not per-request deltas. The cost shown is an approximation of the **current context cost**, not total session spend. After compaction, the displayed cost will decrease as context shrinks. This is labeled "~$X.XX" (with tilde) to signal the approximation. True session-cumulative cost tracking would require delta accumulation across invocations, which is out of scope for v1.

## Transcript Parsing (Incremental)

Instead of reparsing the entire JSONL file each invocation:

1. Cache stores `{ path, mtime, size, offset, data }` in `~/.claude/plugins/claude-cockpit/cache/`
2. On each invocation, check if mtime/size changed
3. If size decreased (compaction detected): reparse from scratch, reset offset
4. If size increased: seek to stored offset, read only new lines
5. Parse new entries, merge with cached data (tool_result updates matching tool_use by ID)
6. Handle partial line at offset boundary: discard incomplete line, adjust offset to next newline
7. Update offset

This reduces I/O on large transcripts from O(n) to O(delta).

### Extracted Data

- **Tools**: last 20 tool_use/tool_result entries with status (running/completed/error)
- **Agents**: last 10 agent entries with name, model, status, description
- **Todos**: latest snapshot from TodoWrite or TaskCreate/TaskUpdate events
- **Session start**: timestamp of first entry (for duration calculation)
- **Session name**: from custom-title or slug fields

## Configuration

### File Location

`~/.claude/plugins/claude-cockpit/config.json`

### Schema

```json
{
  "theme": "default",
  "layout": "expanded",
  "powerlineGlyphs": true,
  "segments": {
    "model": { "enabled": true },
    "context": { "enabled": true },
    "usage": { "enabled": true, "showSevenDay": "auto" },
    "cost": { "enabled": true },
    "activity": { "enabled": true, "maxTools": 20 },
    "agents": { "enabled": true },
    "todos": { "enabled": true },
    "duration": { "enabled": true },
    "session": { "enabled": true }
  },
  "colors": {
    "model": "blue",
    "context": { "low": "green", "mid": "yellow", "high": "red" },
    "usage": { "normal": "cyan", "warning": "red" },
    "cost": "magenta",
    "activity": 245,
    "agents": 208,
    "todos": "green"
  },
  "cost": {
    "prices": {
      "opus": { "input": 15, "output": 75, "cacheRead": 1.5, "cacheWrite": 18.75 },
      "sonnet": { "input": 3, "output": 15, "cacheRead": 0.3, "cacheWrite": 3.75 },
      "haiku": { "input": 0.25, "output": 1.25, "cacheRead": 0.025, "cacheWrite": 0.3 }
    }
  }
}
```

### Validation

Config is validated at load time using a hand-written validator (~50 lines of type checks with defaults). Invalid fields fall back to defaults with a warning printed to stderr (not stdout, which is reserved for the HUD output).

### Layout Modes

- **expanded**: Line 1 = metrics, Line 2 = activity (if active)
- **compact**: Everything on one line, activity truncated if needed

## File Structure

```
claude-cockpit/
├── src/
│   ├── index.ts           # entry point, main() with DI
│   ├── stdin.ts            # parse stdin JSON
│   ├── transcript.ts       # incremental JSONL parser with cache
│   ├── segments/
│   │   ├── model.ts        # model name segment
│   │   ├── context.ts      # context bar segment
│   │   ├── usage.ts        # rate limit segment
│   │   ├── cost.ts         # cost tracking segment
│   │   ├── activity.ts     # tool activity segment
│   │   ├── agents.ts       # agent status segment
│   │   ├── todos.ts        # todo progress segment
│   │   ├── duration.ts     # session duration segment
│   │   └── session.ts      # session name segment
│   ├── renderer.ts         # powerline assembly + ANSI output
│   ├── config.ts           # hand-written validator, load, merge
│   ├── types.ts            # shared types
│   └── colors.ts           # ANSI 256 color helpers + powerline glyphs
├── tests/
│   ├── stdin.test.ts
│   ├── transcript.test.ts
│   ├── renderer.test.ts
│   ├── config.test.ts
│   ├── cost.test.ts
│   └── segments/
│       └── *.test.ts
├── commands/
│   └── configure.md        # /claude-cockpit:configure skill prompt
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

### Runtime
None. Bun/Node.js stdlib only (fs, path, os, readline). No Zod — config validation is hand-written (~50 lines of type checks with defaults).

### Dev Dependencies
- `typescript ^5.0`
- `bun-types` — Bun type definitions
- `@types/node`

### Build

`bun build src/index.ts --target=bun --outfile=dist/cockpit.js` produces a single bundled JS file. The statusLine command points to this bundle. No `node_modules` needed at runtime.

## Distribution

Published as a Claude Code native plugin via a custom marketplace entry:

```json
{
  "extraKnownMarketplaces": {
    "claude-cockpit": {
      "source": {
        "source": "github",
        "repo": "username/claude-cockpit"
      }
    }
  }
}
```

The statusLine config points to the built bundle:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun /path/to/claude-cockpit/dist/cockpit.js"
  }
}
```

## Testing Strategy

- **Unit tests** for each segment function (pure functions, easy to test)
- **Integration tests** for renderer (mock segments, verify ANSI output)
- **Stdin tests** with fixture JSON files
- **Transcript tests** with fixture JSONL files, including incremental parsing
- **Config tests** for schema validation, migration, defaults

## What This Does NOT Include

- No plugin/extension system (YAGNI)
- No themes beyond color customization (one good design > many mediocre ones)
- No daemon/polling mode (Claude Code invokes us, we respond once)
- No web UI (configure skill is a guided terminal conversation, not a GUI)
- No git segment (user chose not to include it)

## Segment Fallback Behavior

When data is missing or unavailable, segments degrade gracefully:

| Segment | Missing Data | Behavior |
|---------|-------------|----------|
| model | model.id empty | Show "Unknown" |
| context | used_percentage absent + tokens = 0 | Show "0%" |
| usage | rate_limits null | Hide segment entirely |
| cost | model unrecognized | Show "~$?.??" with Sonnet pricing |
| activity | no tools in transcript | Hide segment entirely |
| agents | no agents in transcript | Hide segment entirely |
| todos | no todos in transcript | Hide segment entirely |
| duration | no session start in transcript | Hide segment entirely |
| session | no custom-title or slug | Hide segment entirely |

## Performance Budget

The statusLine is invoked by Claude Code on every render tick (~300ms). The entire execution must complete fast enough to not cause visible lag.

**Target: <100ms total execution time**, broken down as:

| Phase | Budget | Notes |
|-------|--------|-------|
| Bun startup + bundle load | ~30ms | Single pre-built JS file, no module resolution |
| Stdin parse | <1ms | Single JSON.parse() |
| Config load | <5ms | Single file read + validate |
| Transcript parse (incremental) | <20ms | Only new lines since last offset |
| Segment computation | <5ms | Pure functions, no I/O |
| Render + stdout | <5ms | String concatenation + write |
| **Total** | **<70ms** | ~30ms headroom |

**Optimizations:**
- `bun build` bundle eliminates module resolution overhead
- Incremental transcript parsing avoids re-reading entire JSONL
- Config is read once per invocation (no watch/polling)
- No git calls (removed from scope)

## Configure Skill

A `/claude-cockpit:configure` skill provides an interactive configuration flow, similar to claude-hud's configure skill. It is shipped as a Claude Code skill (markdown file in the plugin's `commands/` directory).

**Flow:**
1. Read current config.json (or detect first run)
2. Ask layout preference (expanded/compact)
3. Ask which segments to enable/disable (multi-select)
4. Ask powerline glyphs on/off
5. Preview the resulting HUD
6. Confirm and save

The skill is a markdown prompt file that instructs Claude to use `AskUserQuestion` for each step and `Write` to save the config. No code execution required — it's a guided conversation.

**File:** `claude-cockpit/commands/configure.md`

## Platform Notes

### Powerline Fonts

Powerline glyphs (U+E0B0) require a Nerd Font or Powerline-patched font. If the user's terminal font doesn't support these, they'll render as boxes. Config option `"powerlineGlyphs": false` falls back to ASCII separators (`>`).

### Windows Compatibility

- Transcript paths use Windows backslashes (`C:\Users\...`). All path operations use `path.resolve()` for normalization
- ANSI color support assumed (Windows Terminal, Git Bash, VS Code terminal all support it)
- Bun must be available in PATH
