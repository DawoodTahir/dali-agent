import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { config, llmEnabled, whatsappEnabled } from "./config";
import { lastLlmError } from "./engine/llm";
import { webhookRouter } from "./whatsapp/webhook";
import { simulateRouter } from "./routes/simulate";
import { leadsRouter } from "./routes/leads";

const app = express();

app.use(
  cors({
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: false,
  })
);

// Capture the raw body so the WhatsApp signature can be verified.
app.use(
  express.json({
    limit: "1mb",
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    agency: config.agencyName,
    llm: llmEnabled() ? config.llmModel : "mock",
    // Non-null once a real call has failed and silently fallen back to the mock.
    // Surfaced so a live demo can't quietly become a mock demo.
    llmError: lastLlmError(),
    whatsapp: whatsappEnabled() ? "connected" : "simulator-only",
    thresholds: { qualify: config.qualifyThreshold, disqualify: config.disqualifyThreshold },
  });
});

app.use("/webhook", webhookRouter);
app.use("/api/simulate", simulateRouter);
app.use("/api/leads", leadsRouter);

// Serve the built frontend for single-service hosting.
//
// Auto-on: if web/dist is present next to the server, serve it — so a one-service
// deploy (Render, Fly, a VPS) just works without needing SERVE_WEB set. Opt out
// with SERVE_WEB=0 for an API-only host. This is deliberately forgiving: forgetting
// the env var should not leave the UI dark ("Cannot GET /").
const webDist = path.resolve(__dirname, "../../web/dist");
const serveWeb = process.env.SERVE_WEB === "0" ? false : fs.existsSync(webDist);
if (serveWeb) {
  app.use(express.static(webDist));
  app.get("*", (req: Request, res: Response, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
  console.log(`[web] serving static build from ${webDist}`);
} else if (process.env.SERVE_WEB === "0") {
  console.log(`[web] SERVE_WEB=0 — API only, not serving the UI`);
} else {
  console.warn(`[web] no build at ${webDist} — API only. Run "npm run build" in web/ to serve the UI.`);
}

app.listen(config.port, () => {
  console.log(`\n  DALI Qualifier — backend`);
  console.log(`  ├─ http://localhost:${config.port}`);
  console.log(`  ├─ agency:   ${config.agencyName}`);
  console.log(`  ├─ LLM:      ${llmEnabled() ? config.llmModel : "MOCK (no ANTHROPIC_API_KEY)"}`);
  console.log(`  ├─ WhatsApp: ${whatsappEnabled() ? "connected" : "simulator-only"}`);
  console.log(`  └─ qualify ≥ ${config.qualifyThreshold} · disqualify < ${config.disqualifyThreshold}\n`);
});
