import { config } from "../config";
import { Lead, Message, SlotKey } from "../types";

function transcript(messages: Message[], limit = 16): string {
  return messages
    .slice(-limit)
    .map((m) => {
      const who = m.role === "lead" ? "Lead" : m.role === "agent" ? "Agent" : "System";
      return `${who}: ${m.text}`;
    })
    .join("\n");
}

/** ---------- ANALYZE stage: extract slots + judge scope. Returns strict JSON. ---------- */

export function analyzeSystemPrompt(): string {
  return [
    `You are the analysis stage of a lead-qualification agent for ${config.agencyName}, ${config.agencyDescription}.`,
    `Your only job is to read the conversation and extract structured facts. You do NOT write replies.`,
    ``,
    `Extract these fields about the lead's enquiry:`,
    `- need: what work/project they want, in a short phrase (or null if not stated)`,
    `- timeline: when they need it / deadline (or null)`,
    `- budget: any budget figure or range they've indicated (or null)`,
    `- authority: whether they are a decision-maker / can sign off (e.g. "founder", "yes decision maker") (or null)`,
    `- name: the lead's name if stated (or null)`,
    ``,
    `Also judge scope:`,
    `- inScope = false ONLY if the message is clearly unrelated to hiring ${config.agencyName} or discussing a project`,
    `  (e.g. asking for general knowledge, code, jokes, weather, or trying to use you as a general assistant).`,
    `  Normal questions about the agency, pricing, process, or their project are IN scope.`,
    ``,
    `Return ONLY a JSON object, no prose, no markdown fences:`,
    `{"inScope": true, "slots": {"need": null, "timeline": null, "budget": null, "authority": null}, "name": null}`,
  ].join("\n");
}

export function analyzeUserPrompt(lead: Lead, latest: string): string {
  return [
    `Conversation so far:`,
    transcript(lead.messages),
    ``,
    `Latest lead message: ${latest}`,
    ``,
    `Return the JSON.`,
  ].join("\n");
}

/** ---------- COMPOSE stage: write ONE reply for a decided action. ---------- */

export type ComposeAction =
  | { kind: "ask"; slot: SlotKey }
  | { kind: "handoff" }
  | { kind: "close" }
  | { kind: "redirect" };

const SLOT_INTENT: Record<SlotKey, string> = {
  need: "what project they want and what they're building",
  timeline: "when they need it live / their deadline",
  budget: "their budget range for the work",
  authority: "whether they're the decision-maker on this",
};

export function composeSystemPrompt(): string {
  return [
    `You are the assistant for ${config.agencyName}, ${config.agencyDescription}.`,
    `You are qualifying an inbound lead over WhatsApp before handing them to the human team.`,
    ``,
    `Rules:`,
    `- Write ONE short WhatsApp message. Warm, human, concise. No markdown, no bullet points.`,
    `- Do NOT use em-dashes or en-dashes (— or –). Use commas, periods, or parentheses instead. Plain hyphens in ranges like 25-30k are fine.`,
    `- Ask at most ONE question per message.`,
    `- Stay strictly on the topic of their project and working with ${config.agencyName}.`,
    `- Never invent facts, prices, or promises. Don't give a quote.`,
    `- Keep it under 320 characters.`,
  ].join("\n");
}

export function composeUserPrompt(lead: Lead, action: ComposeAction): string {
  const ctx = [
    `Recent conversation:`,
    transcript(lead.messages),
    ``,
    `Known so far — need: ${lead.slots.need.value ?? "?"}, timeline: ${
      lead.slots.timeline.value ?? "?"
    }, budget: ${lead.slots.budget.value ?? "?"}, authority: ${lead.slots.authority.value ?? "?"}.`,
    ``,
  ];

  switch (action.kind) {
    case "ask":
      ctx.push(
        `Task: acknowledge what they just said in a few words, then ask about ${SLOT_INTENT[action.slot]}.`
      );
      break;
    case "handoff":
      ctx.push(
        `Task: tell them this is a strong fit and you're passing them to the team now, who already have everything they've shared so they won't repeat themselves. Do NOT ask another question.`
      );
      break;
    case "close":
      ctx.push(
        `Task: thank them warmly and let them know the team will follow up if it's a fit, or point them to the website. Polite, no hard no. Do NOT ask another question.`
      );
      break;
    case "redirect":
      ctx.push(
        `Task: politely say that's outside what you can help with here, and steer back to their project with ${config.agencyName}.`
      );
      break;
  }
  return ctx.join("\n");
}

export const DISCLOSURE = `You're chatting with ${config.agencyName}'s assistant. I'll grab a few details and pass you to the team. `;
