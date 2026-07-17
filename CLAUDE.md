# CLAUDE.md — agent instructions

Instructions for an AI coding agent (Claude Code, Cursor, etc.) working in this repo.
Read this before running or editing anything. If you're a human, `README.md` is the friendlier read.

## What this is (in one breath)

An AI WhatsApp lead-qualification agent. A scoped conversational agent qualifies inbound leads
(need / timeline / budget / authority), scores them deterministically, and hands off qualified
ones. It runs **without any external credentials** thanks to a mock LLM + a built-in chat
simulator, so you can run and verify it immediately.

```
server/   TypeScript + Express (CommonJS). Engine + WhatsApp webhook + REST/SSE API.
web/      React + Vite + TS (ESM). Simulator + Dashboard.
```

## Run it (do this first to confirm a working baseline)

Node 18+ required. Two processes.

```bash
# terminal 1 — backend on :8080
cd server
cp -n .env.example .env        # no keys needed; mock mode is the default
npm install
npm run dev

# terminal 2 — frontend on :5173 (proxies /api + /webhook to :8080)
cd web
npm install
npm run dev
```

Then open http://localhost:5173 → **Simulator** tab.

## Verify without a browser (use this after any change)

```bash
# backend must be running on :8080
S="check-$RANDOM"
curl -s -X POST localhost:8080/api/simulate -H 'content-type: application/json' \
  -d "{\"sessionId\":\"$S\",\"text\":\"Hi, do you do brand identity? skincare line, live by October, budget 25-30k, I'm the founder\"}" \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0));console.log(d.lead.status, d.lead.score, "|", d.reply)'
# expect: qualified 100 | ...handing you to the team...
curl -s localhost:8080/health   # shows llm=mock|<model>, whatsapp=simulator-only|connected
```

## Self-check commands (run before declaring a change done)

```bash
cd server && npm run typecheck        # tsc --noEmit, must pass
cd web    && npm run build            # tsc -b && vite build, must pass
```

Both must be clean. There is no test suite yet — the curl check above + these two are the gate.

## Where things live (and the one rule that matters)

- `server/src/engine/qualifier.ts` — the state machine: **guardrail → extract → score → decide → compose**. Start here.
- `server/src/engine/scoring.ts` — scoring + slot order. **The code decides handoff, not the model.** Keep it that way: extraction/phrasing is the LLM's job; scoring and the decision must stay deterministic and auditable.
- `server/src/engine/llm.ts` — Anthropic client (**official `@anthropic-ai/sdk`**, not raw fetch) with a **deterministic mock fallback**. If `ANTHROPIC_API_KEY` is unset OR a call throws, it uses the mock. Never remove the fallback — the demo depends on it. `analyze()` uses **structured outputs** (`output_config.format` + a JSON schema), so the model cannot return unparseable JSON — don't reintroduce hand-rolled JSON scraping. Every call reports a `source: "claude" | "mock"` so a silent fallback is visible in the UI rather than passed off as real; `lastLlmError()` feeds `/health.llmError`.
- `server/src/engine/prompts.ts` — analyze + compose prompts, and the AI-disclosure string.
- `server/src/store.ts` — **in-memory** store + SSE `EventEmitter`. This is the single swap point for Postgres; nothing else touches storage directly. If you add a DB, keep this module's exported function signatures identical.
- `server/src/whatsapp/` — `webhook.ts` (GET verify + POST receive, signature-checked), `client.ts` (send), `verifySignature.ts`.
- `web/src/components/` — `Simulator.tsx`, `Dashboard.tsx`, `ScorePanel.tsx`, `LeadList.tsx`, `Transcript.tsx`.

## Conventions

- **server** is CommonJS TypeScript (`module: CommonJS`). Import without file extensions. Run dev with `tsx`, build with `tsc`.
- **web** is ESM (Vite). `import.meta.env.VITE_API_URL` selects the backend (empty = same origin / dev proxy).
- Config is env-driven via `server/src/config.ts`. Thresholds (`QUALIFY_THRESHOLD`, `DISQUALIFY_THRESHOLD`), agency identity, and the LLM model are all env vars — change behaviour there, not in code.
- Types are duplicated between `server/src/types.ts` and `web/src/types.ts` on purpose (no shared package, simpler hosting). Keep them in sync if you edit the `Lead`/`Slot`/`Trace` shape.
- **The model is Haiku 4.5** (`LLM_MODEL`), chosen for latency: every lead turn makes 2 calls (analyze + compose) and this is demoed live. Haiku 4.5 predates the `effort` parameter and adaptive thinking — **do not pass `thinking` or `output_config.effort` to it, both error**. If you move to Sonnet 5 / Opus 4.8, those become available.
- Every turn returns a `Trace` (`server/src/types.ts`) — a read-only record of the graph for that turn, rendered by `web/src/components/EngineTrace.tsx`. It is **observational only**: never let the trace or the UI influence the decision. If you add a stage to the graph, add it to the trace too.

## Common tasks

- **Add a qualification slot:** update `SlotKey`, `SLOT_ORDER`, `SLOT_WEIGHTS` in `server/src/types.ts` (keep weights summing to 100), extend the analyze prompt in `prompts.ts`, mirror the types in `web/src/types.ts`, and add a label in `ScorePanel.tsx`.
- **Change the bar:** edit `QUALIFY_THRESHOLD` / `DISQUALIFY_THRESHOLD` in `.env` — no code change.
- **Add persistence:** replace `store.ts` internals with a Postgres repo, preserving exported functions (`getOrCreateLead`, `saveLead`, `getLead`, `listLeads`, `stats`, `events`).
- **Swap LLM provider:** change the client calls in `llm.ts`; keep `analyze()` returning `Analysis` and `compose()` returning `Composition` (`{ text, source }`), and keep the mock fallback. Both carry `source` — set it honestly, the UI badges it.

## Constraints & gotchas — DON'T trip on these

- **The mock guardrail is keyword-based and deliberately blunt.** Real scope-judging only works with `ANTHROPIC_API_KEY` set. Don't "fix" mock edge cases by loosening the real prompt.
- **In-memory store = single instance only.** Do not deploy multiple replicas without adding a shared store first; SSE + leads would diverge.
- **Never commit `.env`** (it's gitignored). Never hardcode tokens.
- **WhatsApp is not wired up by default and that's intentional.** To connect it you need a Meta app + WABA, a **permanent** System User token (the console one expires in 24h), a **public HTTPS** webhook (Meta won't call localhost — tunnel it), the verify token matching `WHATSAPP_VERIFY_TOKEN`, and the `messages` field subscribed. See README → "Connecting real WhatsApp". Do not attempt to send outbound to un-opted-in numbers, and do not add template-broadcast features to this POC.
- **24h window:** the agent only replies to inbound messages inside the 24h window, so no message templates are needed. If you add re-engagement, it requires pre-approved utility templates — out of scope for this POC.
- Free-form service replies are free until **1 Oct 2026**, then chargeable — keep conversations short.

## Definition of done for a change

1. `server: npm run typecheck` clean.
2. `web: npm run build` clean.
3. The curl verify above still ends in `qualified 100`.
4. No secrets committed; `.env.example` updated if you added a config var.
