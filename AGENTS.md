# AGENTS.md

Agent instructions for this repo live in **[CLAUDE.md](./CLAUDE.md)** — read that first.

Quick reference:

```bash
# run (no credentials needed — mock LLM + built-in simulator)
cd server && cp -n .env.example .env && npm install && npm run dev   # :8080
cd web    && npm install && npm run dev                              # :5173  -> open this

# self-check after any change
cd server && npm run typecheck      # must pass
cd web    && npm run build          # must pass
```

Golden rule: the **code** decides the handoff (deterministic scoring in
`server/src/engine/scoring.ts`), the **LLM** only extracts and phrases. Keep that split.
Full details, file map, conventions, and WhatsApp constraints are in CLAUDE.md.
