# PePe-Fren Port — AnythingLLM Base + PandaCode Module Ports

## Base
- **AnythingLLM** (Mintplex-Labs/anything-llm) `master` @ `8239cd85` — Node/Express + Prisma backend (v1.18.0), Vite/React frontend.
- Full source archived at `work/anythingllm-archive/anything-llm-master/`.
- Git partial clone also at `work/anythingllm-base/` (blob:none).

## Source for ports
- **PandaCode** (aicodeking/pandacode) `main` — Tauri desktop app, TS frontend.
- Archived at `work/pandacode-archive/pandacode-main/`.

## Ported modules (Tier 1, JS, lint-clean)

| Module | Lines | Source | Target |
|---|---|---|---|
| token-saver | 115 | `src/token-saver.ts` | `frontend/src/utils/token-saver.js` |
| message-queue | 79 | `src/message-queue.ts` | `frontend/src/utils/message-queue.js` |
| thread-find | 163 | `src/thread-find.ts` | `frontend/src/utils/thread-find.js` |

Each port converts TS → JS, adapts storage keys/headers to AnythingLLM, and inlines minimal DOM helpers (escape/icon) to avoid pulling the heavy dom pipeline.

## Remaining Tier 1 (not yet ported)
- `slash-commands.ts` (245L) — moderate, pure
- `tool-activity.ts` + `tool-trace.ts` (104+341L) — moderate, pure
- `rich-markdown.ts` (215L) — heavy (dom + enriched-markdown + generative-ui + dompurify)
- `attachments.ts` (236L) — heavy (bridge file picker + dom)

## Tier 2 (not started)
agent-input, subagents, skills-library, file-links, file-mentions, turn-changes, dom (shared)

## Tier 3 (not portable — desktop/Tauri-specific)
worktrees, vm-panel, simulator*, moodboards, github-hub, cloud-settings, terminal-panel, browser

## Status
Paused 2026-10-23. Progress saved: 3 of 7 Tier-1 modules ported and lint-verified.
