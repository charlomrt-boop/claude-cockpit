# /claude-cockpit:configure

Interactive configuration wizard for the claude-cockpit HUD.

Guide the user through configuring their HUD step by step, then save the result to `~/.claude/plugins/claude-cockpit/config.json`.

---

## Step 0 — Read existing config

Use the Read tool to read `~/.claude/plugins/claude-cockpit/config.json`.

- If the file exists: parse it as JSON and use its values as defaults for every question below.
- If the file does not exist or is unreadable: use the defaults listed below (first-run mode).

---

## Step 1 — Layout

Ask:

> **Layout preference?**
> - `expanded` (default) — two lines: metrics on line 1, activity on line 2 when active
> - `compact` — single line, activity truncated if needed

Default: `expanded`

---

## Step 2 — Segments

Ask which segments to enable. Present all seven as a list; the user can toggle any subset.

> **Which segments should be enabled?** (all enabled by default)
>
> - `usage` — 5-hour / 7-day rate limit quota
> - `cost` — estimated context window cost (~$X.XX)
> - `activity` — last tool used + tool counter
> - `agents` — active sub-agent name and status
> - `todos` — todo progress (X/Y tasks)
> - `duration` — session elapsed time
> - `session` — session name / slug

Note: `model` and `context` segments are always on and not configurable.

---

## Step 3 — Powerline glyphs

Ask:

> **Powerline glyphs?**
> - `on` (default) — use Nerd Font arrows  (requires a Powerline/Nerd Font)
> - `off` — ASCII fallback separators `>`

Default: `on`

---

## Step 4 — Preview

Show a representative preview based on the chosen options.

**Expanded layout, glyphs on:**
```
 Sonnet 4.5  ████░░░ 42%  5h: 25%  ~$0.12  12m  fix-auth
 ◐ Edit: auth.ts | ✓ Read ×3  ◐ agent-1  ▸ 2/5
```

**Expanded layout, glyphs off:**
```
[Sonnet 4.5] [████░░░ 42%] [5h: 25%] [~$0.12] [12m] [fix-auth]
[◐ Edit: auth.ts | ✓ Read ×3] [◐ agent-1] [▸ 2/5]
```

**Compact layout, glyphs on:**
```
 Sonnet 4.5  ████░░░ 42%  5h: 25%  ~$0.12  12m  fix-auth  ◐ Edit: auth.ts
```

Adapt the preview to reflect which segments the user actually enabled (omit disabled ones).

---

## Step 5 — Confirm and save

Show a summary of the chosen settings, then ask:

> **Save this configuration?**
> - `yes` — write config and finish
> - `no` — discard and exit without saving

If the user confirms, use the Write tool to write the following JSON to `~/.claude/plugins/claude-cockpit/config.json`.

---

## Config schema to write

Merge the user's choices over the existing config (preserve any fields not touched by this wizard, e.g. `colors`, `cost.prices`). The minimal writable shape is:

```json
{
  "layout": "expanded",
  "powerlineGlyphs": true,
  "segments": {
    "usage":    { "enabled": true  },
    "cost":     { "enabled": true  },
    "activity": { "enabled": true  },
    "agents":   { "enabled": true  },
    "todos":    { "enabled": true  },
    "duration": { "enabled": true  },
    "session":  { "enabled": true  }
  }
}
```

- Set `"layout"` to `"expanded"` or `"compact"` per step 1.
- Set `"powerlineGlyphs"` to `true` or `false` per step 3.
- Set each segment's `"enabled"` to `true` or `false` per step 2.
- Preserve `"usage": { "showSevenDay": "auto" }` if it was present in the existing config (do not overwrite sub-keys not asked about).
- Preserve `"activity": { "maxTools": N }` if it was present.
- Preserve `"colors"` and `"cost"` blocks unchanged.

After writing, confirm to the user:

> Config saved to `~/.claude/plugins/claude-cockpit/config.json`. The HUD will use the new settings on the next Claude Code invocation.
