# PePe-Fren Port — AnythingLLM Base + PandaCode Module Ports

## Base
- **AnythingLLM** (Mintplex-Labs/anything-llm) `master` @ `8239cd85` — Node/Express + Prisma backend (v1.18.0), Vite/React frontend.
- Full source archived at `work/anythingllm-archive/anything-llm-master/`.
- Git partial clone also at `work/anythingllm-base/` (blob:none).

## Source for ports
- **PandaCode** (aicodeking/pandacode) `main` — Tauri desktop app, TS frontend.
- Archived at `work/pandacode-archive/pandacode-main/`.

## Ported modules (Tier 1)

| Module | Lines | Source | Ported file | Notes |
|---|---|---|---|---|
| token-saver | 115 | `src/token-saver.ts` | `ported/utils/token-saver.js` | TS→JS, storage key + header adapted |
| message-queue | 79 | `src/message-queue.ts` | `ported/utils/message-queue.js` | TS→JS, inlined escape/icon |
| thread-find | 163 | `src/thread-find.ts` | `ported/utils/thread-find.js` | TS→JS, inlined icon |
| slash-commands | 245 | `src/slash-commands.ts` | `ported/utils/slash-commands.js` | TS→JS via esbuild; depends on provider-logos + popover-motion |
| tool-activity | 104 | `src/tool-activity.ts` | `ported/utils/tool-activity.js` | TS→JS via esbuild; depends on tool-trace |
| tool-trace | 341 | `src/tool-trace.ts` | `ported/utils/tool-trace.js` | TS→JS via esbuild; pure logic, 30+ exports |

Each port converts TS→JS, adapts storage keys/headers to AnythingLLM, and inlines minimal DOM helpers (escape, icon) to avoid pulling the heavy dom pipeline. All 6 Tier-1 modules are now .js (converted via esbuild).

## Remaining Tier 1 (not yet ported)
- `rich-markdown.ts` (215L) — heavy (dom + enriched-markdown + generative-ui + dompurify)
- `attachments.ts` (236L) — heavy (bridge file picker + dom)

## Tier 2 (not started)
agent-input, subagents, skills-library, file-links, file-mentions, turn-changes, dom (shared)

## Tier 3 (not portable — desktop/Tauri-specific)
worktrees, vm-panel, simulator*, moodboards, github-hub, cloud-settings, terminal-panel, browser

## Status
Resumed 2026-10-23. Progress: 6 of 8 Tier-1 modules ported (all .js, lint-clean). 2 heavy modules remain (rich-markdown, attachments).
