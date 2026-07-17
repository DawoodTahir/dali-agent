# DALI Qualifier — UI revamp brief

Hand this file, plus the `web/` folder, to a design agent. It says what the product
is, which files to touch, and — critically — **what must not break**, so a visual
revamp doesn't sever the wiring to the backend.

---

## What the product is

An **AI WhatsApp lead-qualification agent**, shown as a browser demo. A scoped
conversational agent qualifies inbound leads on four things — **need, timeline,
budget, authority** — scores them deterministically, and hands the good ones to a
human. This UI is what gets **pitched live**, so it has to read instantly on a
projector and never look broken.

Two tabs:

- **Simulator** — you play an inbound lead. Pick a persona or type. The agent
  replies, a score climbs, and a per-turn **engine trace** shows the pipeline
  (`guardrail → extract → score → decide → compose`), each stage badged **code**
  or **claude**. This trace is the heart of the pitch: it proves *the code decides
  the handoff, the model only extracts and phrases*.
- **Dashboard** — an ops view: stat tiles, a live lead list (updates over SSE), and
  a transcript with the score panel.

## The one idea the design must carry

**"The code decides, not the model."** Scoring and the handoff decision are plain,
auditable arithmetic; the LLM only extracts facts and writes the phrasing. The UI
should make that split *legible* — the `code` vs `claude` badges in the engine
trace, the weighted slots, and the qualify-bar on the score meter are all in
service of that story. Don't design it away.

## Pitch-critical honesty cues (keep these, restyle freely)

These exist because the demo can silently fall back to a keyword mock if the
Anthropic API fails (e.g. no credit). The design may restyle them but must **not
remove** them, or the demo could pass off mock output as real Claude:

- The **status chip** (top right): green "live · <model>" vs amber "falling back to
  mock" vs "mock LLM — no API key".
- The **fallback banner**: a plain-language warning when a live call failed.
- The **per-message `claude` / `mock` source badge** on each agent reply.

---

## Files to work with

All under `web/`. Total ~1,280 lines. This is a **React + Vite + TypeScript (ESM)**
app. One global stylesheet — **no Tailwind, no CSS-in-JS, no component library** —
plain CSS custom properties. A revamp can introduce a different approach, but the
current system is easy to restyle wholesale by editing `styles.css` alone.

| File | Lines | What it is |
|---|---|---|
| `src/styles.css` | 469 | **The entire design system** — tokens, layout, every component's styling. The main lever: most revamps can happen here alone. |
| `src/components/Simulator.tsx` | 208 | Chat/phone view, the four lead personas, composer, score + trace side panel. |
| `src/components/EngineTrace.tsx` | 110 | The five-stage pipeline panel with code/claude badges. **The pitch centrepiece.** |
| `src/App.tsx` | 95 | Shell: top bar, brand, tabs, status chip, fallback banner, footer. |
| `src/components/Dashboard.tsx` | 89 | Stat tiles + lead list + transcript layout, SSE wiring. |
| `src/types.ts` | 83 | Shared types + slot labels/weights/asks. Mirrors the server. |
| `src/components/ScorePanel.tsx` | 67 | Score readout, qualify-bar meter, weighted slot list. |
| `src/api.ts` | 51 | Fetch/SSE calls to the backend. **Contract — see constraints.** |
| `src/components/Transcript.tsx` | 48 | Dashboard conversation view. |
| `src/components/LeadList.tsx` | 42 | Dashboard lead list rows. |
| `index.html` | 12 | Doc shell + `<title>`. |
| `src/main.tsx` | 10 | React entry. Don't touch. |

Fonts are currently **system-only** (`ui-sans-serif`, `ui-monospace`) — a revamp is
welcome to introduce real typefaces (self-hosted or a `<link>` in `index.html`).

---

## Hard constraints — do NOT break these

The UI talks to a real backend. Break these and the demo goes blank or the engine
stops working. **Restyle anything; rewire nothing.**

1. **Don't change the API contract in `api.ts`.** Endpoints, request bodies, and
   response shapes are fixed by the server:
   - `POST /api/simulate` with `{ sessionId, text }` → `{ reply, action, trace, lead }`
   - `GET /api/leads` → `{ leads, stats }`
   - `GET /api/leads/stream` (SSE: `snapshot` + `lead` events)
   - `GET /health` → `{ llm, llmError, whatsapp, thresholds, ... }`
   You may change *how* data is displayed, never the fetch/parse layer's shape.

2. **Keep the `Trace` and `Lead`/`Slot` type shapes** (`types.ts`). They mirror
   `server/src/types.ts` exactly (there's no shared package — they're duplicated on
   purpose). A field you add here must also be added server-side, or it'll be
   `undefined`. For a pure visual revamp, don't add fields — just reshape the markup.

3. **Preserve the four slots and their weights** (`need 20 · timeline 20 ·
   budget 35 · authority 25`, summing to 100) and the **qualify bar at 75**. These
   are the actual scoring rules; the UI must reflect them truthfully, not invent new
   numbers.

4. **Keep the honesty cues** listed above (status chip, fallback banner, source
   badges). Restyle them; don't delete them.

5. **Light-theme is the intended target** (projectors, shared screens). Dark mode is
   optional and a nice-to-have, not required — if added, it must not compromise the
   light version.

6. **It must stay responsive** — this gets shown on laptops and sometimes tablets.
   The current breakpoint is 980px (side panels stack below it).

## What a great revamp delivers

- A sharper, more distinctive visual identity than the current muted teal/paper —
  real type, more considered spacing, a stronger sense of "product", not "POC".
- The engine trace made even more of a hero — it's the thing that wins the pitch.
- The score climbing and slots filling should *feel* satisfying (they animate now;
  make it better).
- Zero loss of the honesty cues or the code-vs-model story.

## How to run it while designing

```bash
cd web && npm install && npm run dev   # http://localhost:5173
# needs the backend on :8080 — see the repo root README to start it
```

`npm run build` must stay clean (`tsc -b && vite build`).
