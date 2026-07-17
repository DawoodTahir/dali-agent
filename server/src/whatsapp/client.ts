import { config, whatsappEnabled } from "../config";

/**
 * Send a free-form text message via the WhatsApp Cloud API.
 * NOTE: free-form text only works inside the 24h customer-service window
 * (i.e. within 24h of the lead's last message). Outside it, you must send a
 * pre-approved template — not implemented in this POC by design.
 */
export async function sendWhatsappText(to: string, body: string): Promise<void> {
  if (!whatsappEnabled()) {
    console.warn("[whatsapp] send skipped — WHATSAPP_TOKEN / PHONE_NUMBER_ID not set");
    return;
  }

  const url = `https://graph.facebook.com/${config.whatsapp.graphVersion}/${config.whatsapp.phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.whatsapp.token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    // Common failures: 401 (expired token), 131047 (outside 24h window), 132000 (template needed).
    console.error(`[whatsapp] send failed ${res.status}: ${t.slice(0, 400)}`);
  }
}
