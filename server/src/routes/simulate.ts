import { Router, Request, Response } from "express";
import { getOrCreateLead } from "../store";
import { handleInbound } from "../engine/qualifier";

export const simulateRouter = Router();

/**
 * POST /api/simulate
 * body: { sessionId: string, text: string, name?: string }
 * Runs the identical qualification engine the real webhook uses, so the
 * Simulator is a faithful preview — no Meta setup required.
 */
simulateRouter.post("/", async (req: Request, res: Response) => {
  const { sessionId, text, name } = req.body ?? {};
  if (!sessionId || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "sessionId and non-empty text are required" });
  }

  const lead = getOrCreateLead("simulator", String(sessionId), name || null);
  const result = await handleInbound(lead, text);

  return res.json({
    reply: result.reply,
    action: result.action,
    trace: result.trace,
    lead: {
      id: lead.id,
      name: lead.name,
      status: lead.status,
      score: lead.score,
      slots: lead.slots,
      messages: lead.messages,
    },
  });
});
