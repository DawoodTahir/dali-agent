# DALI Qualifier — POC

An AI WhatsApp lead-qualification agent. A scoped conversational agent qualifies inbound
leads (need / timeline / budget / authority), scores them against a configurable bar, and
hands the good ones off with full context.

Built so you can **demo it today without any Meta setup** (via the built-in Simulator), and
flip on the **real WhatsApp Cloud API** by adding credentials — same engine drives both.

```
server/   TypeScript + Express. The qualification engine + WhatsApp webhook + REST/SSE API.
web/      React + Vite + TS. Simulator (play the lead) + Dashboard (ops view).
```

> **Using an AI coding agent?** Point it at [`CLAUDE.md`](./CLAUDE.md) (or [`AGENTS.md`](./AGENTS.md)) —
> run commands, a file map, conventions, a self-check loop, and the WhatsApp gotchas, written for agents.

---

## The engine

Every turn runs the same graph, mirroring the proposal:

```
guardrail  → is the message in scope? off-topic gets redirected, not answered
extract    → LLM pulls need / timeline / budget / authority from the transcript (strict JSON)
score      → deterministic, from filled slots. The CODE decides — not the model.
decide     → ask next question | hand off (score ≥ 75) | close politely (< 40, exhausted)
compose    → LLM phrases ONE short, in-scope reply for the decided action
```

The LLM does the talking and the extraction. The scoring and the decision are plain code, so
every score is auditable and the criteria are config, not prompt.

The Simulator renders this graph live, per turn — what the guardrail judged, which slots were
extracted, how the score moved, what the code decided — with each stage badged `claude` or
`code`. The split isn't a claim in a README; it's on screen.

**With `ANTHROPIC_API_KEY` set,** extraction and phrasing are real Claude calls (Haiku 4.5 by
default — two calls per turn, so latency matters). Extraction uses **structured outputs**, so the
model physically cannot return malformed JSON.

**No API key? It still runs.** `engine/llm.ts` falls back to a deterministic mock (keyword
extraction + templated replies), so the whole POC works offline for demos.

**You can always tell which you're looking at.** Every agent reply is badged `claude` or `mock`
in the UI, and if a live call fails mid-demo (bad key, rate limit) the app shows a banner
instead of quietly serving templated replies as if they were real.

---

## Run locally

Requires Node 18+ (tested on 22).

```bash
# 1. backend
cd server
cp .env.example .env          # optional: add ANTHROPIC_API_KEY for real LLM replies
npm install
npm run dev                   # http://localhost:8080

# 2. frontend (new terminal)
cd web
npm install
npm run dev                   # http://localhost:5173  (proxies /api + /webhook to :8080)
```

Open http://localhost:5173 → **Simulator** tab. Talk to the agent as if you were a lead.
Watch the score climb and slots fill. Switch to **Dashboard** to see the lead appear live.

---

## Connecting real WhatsApp

The Simulator needs nothing. To drive it from an actual WhatsApp number:

1. **Meta app + WABA.** Create an app at developers.facebook.com, add the *WhatsApp* product.
   You get a **test phone number** that can message up to 5 verified recipients with no
   business verification — enough to demo. Real customers need business verification (days–weeks).
2. **Permanent token.** The console token expires in **24h**. Create a System User in
   Business Settings and generate a non-expiring token with `whatsapp_business_messaging`.
3. **Public HTTPS.** Meta won't call `localhost`. Locally, tunnel it:
   `npx cloudflared tunnel --url http://localhost:8080` (or ngrok). Hosted, use your platform URL.
4. **Configure the webhook** in the Meta app (WhatsApp → Configuration):
   - Callback URL: `https://<your-host>/webhook`
   - Verify token: whatever you set as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the **messages** field.
5. **Fill `.env`:**
   ```
   WHATSAPP_VERIFY_TOKEN=some-random-string
   WHATSAPP_TOKEN=<permanent token>
   WHATSAPP_PHONE_NUMBER_ID=<from the app dashboard>
   WHATSAPP_APP_SECRET=<app secret, for signature verification>
   ```
   Restart. Message the test number from a verified phone — the agent replies, and the lead
   shows up on the Dashboard alongside simulator leads.

### Known WhatsApp constraints baked into this build
- **24-hour window:** free-form replies only within 24h of the lead's last message. This POC
  only replies inbound-in-window, so no templates are needed. Re-engaging a cold lead in
  production requires a pre-approved *utility* template.
- **Inbound only:** no cold outbound. The lead messages first (compliant + required).
- **Scoped agent:** the guardrail keeps it on-topic — this is what keeps it on the right side
  of Meta's Jan 2026 ban on general-purpose bots.
- **Signature check:** `POST /webhook` verifies `X-Hub-Signature-256` when `WHATSAPP_APP_SECRET`
  is set (uses the raw body — see `server/src/index.ts`).
- **Pricing:** free-form service replies are free until **1 Oct 2026**, then chargeable at the
  utility rate. Keep flows short.

---

## Hosting

**Backend** → any HTTPS Node host (Render, Railway, Fly, a VPS behind Caddy). It needs a public
HTTPS URL for the webhook. The store is **in-memory**, so run a **single instance** for the POC
(swap in Postgres for multi-instance / persistence — see `store.ts`).

**Frontend** → build (`npm run build` in `web/`) and deploy the `dist/` to Vercel / Netlify /
Cloudflare Pages, and set `VITE_API_URL` to your backend URL. Or serve it from the backend:
`SERVE_WEB=1` makes Express serve `web/dist` if present (single deploy).

```bash
cd web && npm run build           # outputs web/dist
cd ../server && SERVE_WEB=1 npm run build && npm start
```

---

## What's POC-grade vs production

| Area            | POC (here)                    | Production                                  |
|-----------------|-------------------------------|---------------------------------------------|
| Store           | in-memory Map                 | Postgres (leads, transcripts, scores)       |
| Live updates    | SSE from memory               | SSE/websockets backed by DB + queue         |
| LLM             | 1–2 calls/turn, mock fallback | same, + caching, retries, eval harness      |
| Re-engagement   | none (in-window only)         | approved utility templates + scheduler      |
| Multi-tenant    | single agency (env config)    | per-client WABA, embedded signup, isolation |
| Auth            | none on dashboard             | real auth on the ops surface                |
```
