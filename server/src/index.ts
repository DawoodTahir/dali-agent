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

// Optionally serve the built frontend (single-deploy hosting).
if (config.serveWeb) {
  const webDist = path.resolve(__dirname, "../../web/dist");
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (req: Request, res: Response, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) return next();
      res.sendFile(path.join(webDist, "index.html"));
    });
    console.log(`[web] serving static build from ${webDist}`);
  } else {
    console.warn(`[web] SERVE_WEB=1 but ${webDist} not found — run "npm run build" in web/`);
  }
}

app.listen(config.port, () => {
  console.log(`\n  DALI Qualifier — backend`);
  console.log(`  ├─ http://localhost:${config.port}`);
  console.log(`  ├─ agency:   ${config.agencyName}`);
  console.log(`  ├─ LLM:      ${llmEnabled() ? config.llmModel : "MOCK (no ANTHROPIC_API_KEY)"}`);
  console.log(`  ├─ WhatsApp: ${whatsappEnabled() ? "connected" : "simulator-only"}`);
  console.log(`  └─ qualify ≥ ${config.qualifyThreshold} · disqualify < ${config.disqualifyThreshold}\n`);
});
