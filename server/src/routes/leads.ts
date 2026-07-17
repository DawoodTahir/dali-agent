import { Router, Request, Response } from "express";
import { events, getLead, listLeads, stats } from "../store";
import { Lead } from "../types";

export const leadsRouter = Router();

// GET /api/leads  -> list (most recently updated first)
leadsRouter.get("/", (_req: Request, res: Response) => {
  res.json({ leads: listLeads(), stats: stats() });
});

// GET /api/leads/stream  -> Server-Sent Events for live dashboard updates
leadsRouter.get("/stream", (req: Request, res: Response) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  // Prime the client with the current snapshot.
  res.write(`event: snapshot\ndata: ${JSON.stringify({ leads: listLeads(), stats: stats() })}\n\n`);

  const onLead = (lead: Lead) => {
    res.write(`event: lead\ndata: ${JSON.stringify({ lead, stats: stats() })}\n\n`);
  };
  events.on("lead", onLead);

  const ping = setInterval(() => res.write(`event: ping\ndata: {}\n\n`), 25000);

  req.on("close", () => {
    clearInterval(ping);
    events.off("lead", onLead);
  });
});

// GET /api/leads/:id  -> single lead (full transcript)
leadsRouter.get("/:id", (req: Request, res: Response) => {
  const lead = getLead(req.params.id);
  if (!lead) return res.status(404).json({ error: "not found" });
  res.json({ lead });
});
