import crypto from "crypto";
import { config } from "../config";

/**
 * Verify Meta's X-Hub-Signature-256 header against the RAW request body.
 * Requires the raw body — see express.json({ verify }) in index.ts.
 * If no app secret is configured, verification is skipped (dev/simulator mode).
 */
export function verifyWhatsappSignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
  if (!config.whatsapp.appSecret) return true; // not configured -> skip
  if (!rawBody || !header) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", config.whatsapp.appSecret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}
