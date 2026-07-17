import { Router, Request, Response } from "express";
import { config } from "../config";
import { getOrCreateLead } from "../store";
import { handleInbound } from "../engine/qualifier";
import { sendWhatsappText } from "./client";
import { verifyWhatsappSignature } from "./verifySignature";

export const webhookRouter = Router();

// Dedupe: Meta can retry deliveries. Remember recent message ids.
const seen = new Set<string>();
function markSeen(id: string): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 5000) seen.clear();
  return true;
}

// ---- GET /webhook : Meta verification handshake ----
webhookRouter.get("/", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken && config.whatsapp.verifyToken) {
    console.log("[whatsapp] webhook verified");
    return res.status(200).send(String(challenge));
  }
  return res.sendStatus(403);
});

// ---- POST /webhook : incoming messages ----
webhookRouter.post("/", async (req: Request & { rawBody?: Buffer }, res: Response) => {
  if (!verifyWhatsappSignature(req.rawBody, req.header("x-hub-signature-256"))) {
    return res.sendStatus(401);
  }

  // Ack fast — Meta expects a prompt 200, then we process.
  res.sendStatus(200);

  try {
    const entries = req.body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const contacts = value.contacts ?? [];
        const messages = value.messages ?? [];
        const profileName: string | undefined = contacts[0]?.profile?.name;

        for (const msg of messages) {
          if (msg.type !== "text") continue; // POC handles text only
          if (!markSeen(msg.id)) continue;

          const from: string = msg.from;
          const text: string = msg.text?.body ?? "";
          if (!text.trim()) continue;

          const lead = getOrCreateLead("whatsapp", from, profileName ?? null);
          const { reply } = await handleInbound(lead, text);
          await sendWhatsappText(from, reply);
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp] webhook processing error:", (err as Error).message);
  }
});
