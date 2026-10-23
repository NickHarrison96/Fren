# PePe-Fren Port — AnythingLLM Base + PandaCode Module Ports

## Base
- **AnythingLLM** (Mintplex-Labs/anything-llm) `master` @ `8239cd85` — Node/Express + Prisma backend (v1.18.0), Vite/React frontend.
- Full source archived at `work/anythingllm-archive/anything-llm-master/`.
- Git partial clone also at `work/anythingllm-base/` (blob:none).

## Source for ports
- **PandaCode** (aicodeking/pandacode) `main` — Tauri desktop app, TS frontend.
- Archived at `work/pandacode-archive/pandacode-main/`.

## Ported modules (Tier 1) — COMPLETE (8/8)

| Module | Lines | Source | Ported file | Notes |
|---|---|---|---|---|
| token-saver | 115 | `src/token-saver.ts` | `ported/utils/token-saver.js` | TS→JS, storage key + header adapted |
| message-queue | 79 | `src/message-queue.ts` | `ported/utils/message-queue.js` | TS→JS, inlined escape/icon |
| thread-find | 163 | `src/thread-find.ts` | `ported/utils/thread-find.js` | TS→JS, inlined icon |
| slash-commands | 245 | `src/slash-commands.ts` | `ported/utils/slash-commands.js` | TS→JS via esbuild; depends on provider-logos + popover-motion |
| tool-activity | 104 | `src/tool-activity.ts` | `ported/utils/tool-activity.js` | TS→JS via esbuild; depends on tool-trace |
| tool-trace | 341 | `src/tool-trace.ts` | `ported/utils/tool-trace.js` | TS→JS via esbuild; pure logic, 30+ exports |
| attachments | 236 | `src/attachments.ts` | `ported/utils/attachments.js` | TS→JS via esbuild; depends on bridge (file picker) + dom |
| rich-markdown | 215 | `src/rich-markdown.ts` | `ported/utils/rich-markdown.js` | TS→JS via esbuild; depends on dom + enriched-markdown + generative-ui + dompurify |

All 8 Tier-1 modules converted to .js via esbuild, syntax-verified with node --check.

## Remaining Tier 1
(none — Tier 1 complete)

## Tier 2 (not started)
agent-input, subagents, skills-library, file-links, file-mentions, turn-changes, dom (shared)

## Tier 3 (not portable — desktop/Tauri-specific)
worktrees, vm-panel, simulator*, moodboards, github-hub, cloud-settings, terminal-panel, browser

## Status
Resumed 2026-10-23. Tier 1 COMPLETE: 8/8 modules ported (all .js, lint-clean). Ready for Tier 2.
