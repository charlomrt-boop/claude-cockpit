# claude-cockpit

## Stack
- TypeScript 5.7, Bun runtime, zero dependencies
- Tests: `bun test` (Bun native runner)
- Build: `bun run build` → `dist/cockpit.js` (gitignored)

## Architecture
- Segments are pure functions: `(data, color, ...) → Segment | null`
- Segment.icon is prepended by renderer — breadcrumb embeds icons in text instead (no icon field)
- Line 1: model, context, usage, cost, burnRate, duration, session
- Line 2: activity, agents, breadcrumb (todos)
- Config reuses `segments.todos` key for breadcrumb (no breaking change)

## Transcript Parser Gotchas
- TaskCreate stores todo with tool_use block.id (UUID), not the task number
- tool_result for TaskCreate contains real ID ("Task #14 created") — parser patches it
- TaskUpdate sends `taskId` (not `id`) — parser must check both fields
- TodoWrite replaces entire list; TaskCreate/TaskUpdate are incremental

## Testing
- All segments have unit tests in `tests/segments/`
- Integration tests in `tests/integration.test.ts` call `buildHud()` directly
- `buildHud` is pure — pass `terminalWidth` as param, don't read `process.stdout.columns` inside
- Config tests produce stderr warnings (expected, not errors)

## Commands
- `bun test` — run all tests
- `bun run build` — bundle to dist/cockpit.js
- `bun test tests/segments/breadcrumb.test.ts` — run specific test file
