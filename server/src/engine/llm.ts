import Anthropic from "@anthropic-ai/sdk";
import { config, llmEnabled } from "../config";
import { Lead, LlmSource, SlotKey } from "../types";
import {
  ComposeAction,
  analyzeSystemPrompt,
  analyzeUserPrompt,
  composeSystemPrompt,
  composeUserPrompt,
} from "./prompts";

export interface Analysis {
  inScope: boolean;
  slots: Partial<Record<SlotKey, string | null>>;
  name: string | null;
  source: LlmSource;
}

export interface Composition {
  text: string;
  source: LlmSource;
}

/**
 * Single client, built once. Reads the key from config (dotenv), so it stays
 * consistent with `llmEnabled()` and the /health readout.
 */
const client = llmEnabled() ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

/** Reason the last real call failed, surfaced on /health so a mid-demo fallback is visible. */
let lastError: string | null = null;
export const lastLlmError = () => lastError;

function nullableString(description: string) {
  return {
    anyOf: [{ type: "string" }, { type: "null" }],
    description,
  };
}

/**
 * Structured output schema for the analyze stage. With this, the model cannot
 * return anything but a valid Analysis — no fenced-JSON scraping, no repair.
 */
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    inScope: {
      type: "boolean",
      description: "false ONLY if the message is clearly unrelated to a project enquiry.",
    },
    name: nullableString("The lead's name if they stated it, else null."),
    slots: {
      type: "object",
      properties: {
        need: nullableString("What work/project they want, as a short phrase, else null."),
        timeline: nullableString("When they need it / their deadline, else null."),
        budget: nullableString("Any budget figure or range they indicated, else null."),
        authority: nullableString("Whether they can sign off (e.g. 'founder'), else null."),
      },
      required: ["need", "timeline", "budget", "authority"],
      additionalProperties: false,
    },
  },
  required: ["inScope", "slots", "name"],
  additionalProperties: false,
} as const;

/** Pull the concatenated text out of a response. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Reduce an SDK error to one short human sentence.
 *
 * This string is shown verbatim in the UI banner during a live demo, so it must
 * never be a raw JSON body — pull the API's own message out of the envelope.
 */
function humanError(err: unknown): string {
  // Typed SDK errors, most specific first. These are the actionable ones.
  if (err instanceof Anthropic.AuthenticationError) return "the API key is invalid (401)";
  if (err instanceof Anthropic.PermissionDeniedError) return "this key can't access that model (403)";
  if (err instanceof Anthropic.NotFoundError) return `no such model: "${config.llmModel}" (404)`;
  if (err instanceof Anthropic.RateLimitError) return "rate limited, too many requests (429)";
  if (err instanceof Anthropic.APIConnectionError) return "couldn't reach api.anthropic.com";

  if (err instanceof Anthropic.APIError) {
    // `.message` embeds the whole response body; the envelope has the clean text.
    const body = (err as { error?: { error?: { message?: string } } }).error;
    const msg = body?.error?.message;
    if (msg) {
      // The billing message is the one people actually hit — make it plain.
      if (/credit balance is too low/i.test(msg)) {
        return "the Anthropic account is out of credit. Top up at console.anthropic.com under Plans & Billing";
      }
      return msg;
    }
  }

  return (err as Error)?.message ?? String(err);
}

/** Record + log a fallback, in a shape that reads clearly in the dev terminal. */
function noteFailure(stage: string, err: unknown): void {
  const detail = humanError(err);
  lastError = detail;
  console.warn(`[llm] ${stage} failed → falling back to mock: ${detail}`);
}

/** ---------------- ANALYZE ---------------- */

export async function analyze(lead: Lead, latest: string): Promise<Analysis> {
  if (client) {
    try {
      const message = await client.messages.create({
        model: config.llmModel,
        max_tokens: 1024,
        system: analyzeSystemPrompt(),
        messages: [{ role: "user", content: analyzeUserPrompt(lead, latest) }],
        // Guarantees the response validates against ANALYSIS_SCHEMA.
        output_config: { format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
      });

      if (message.stop_reason === "refusal") throw new Error("model refused the request");

      const j = JSON.parse(textOf(message));
      lastError = null;
      return {
        inScope: j.inScope !== false,
        slots: j.slots ?? {},
        name: j.name ?? null,
        source: "claude",
      };
    } catch (err) {
      noteFailure("analyze", err);
    }
  }
  return mockAnalyze(lead, latest);
}

/** ---------------- COMPOSE ---------------- */

export async function compose(lead: Lead, action: ComposeAction): Promise<Composition> {
  if (client) {
    try {
      const message = await client.messages.create({
        model: config.llmModel,
        max_tokens: 512,
        system: composeSystemPrompt(),
        messages: [{ role: "user", content: composeUserPrompt(lead, action) }],
      });

      if (message.stop_reason === "refusal") throw new Error("model refused the request");

      const text = textOf(message);
      if (!text) throw new Error("empty reply");
      lastError = null;
      return { text, source: "claude" };
    } catch (err) {
      noteFailure("compose", err);
    }
  }
  return { text: mockCompose(lead, action), source: "mock" };
}

/** =================== DETERMINISTIC MOCK (no API key needed) =================== */

const MONEY = /(£|\$|€|gbp|usd|eur)\s?\d|\d+\s?(k|thousand|grand)\b|\d{3,}/i;
const TIME =
  /\b(today|tomorrow|week|weeks|month|months|q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|asap|urgent|by |end of|deadline)\b/i;
const AUTHORITY =
  /\b(i'?m the|i am the|founder|ceo|owner|director|my call|my decision|decision[- ]?maker|i decide|i sign)\b/i;
const OFFTOPIC =
  /\b(weather|joke|poem|recipe|write me (a|some) code|python|translate|who won|capital of|meaning of life)\b/i;

const PROJECT_WORD =
  /\b(brand|identity|logo|campaign|website|web ?site|design|rebrand|packaging|project|marketing|agency|quote|work with|hire|help with|build|launch)\b/i;

function mockAnalyze(lead: Lead, latest: string): Analysis {
  const t = latest.toLowerCase();
  const slots: Partial<Record<SlotKey, string | null>> = {};

  // Off-topic wins over incidental time/money words unless there's a real project word.
  const inScope = !(OFFTOPIC.test(t) && !PROJECT_WORD.test(t));

  // need: mention of a project/service word
  if (!lead.slots.need.filled && PROJECT_WORD.test(t)) {
    slots.need = latest.slice(0, 80);
  }
  if (!lead.slots.timeline.filled && TIME.test(t)) {
    slots.timeline = (latest.match(TIME)?.[0] || "stated") + " (from message)";
  }
  if (!lead.slots.budget.filled && MONEY.test(t)) {
    slots.budget = latest.match(/[£$€]?\s?\d[\d,\.]*\s?(k|thousand|grand)?/i)?.[0] || "stated";
  }
  if (!lead.slots.authority.filled && AUTHORITY.test(t)) {
    slots.authority = "decision-maker";
  }

  // crude name capture: "I'm Marcus" / "this is Sarah"
  let name: string | null = null;
  const m = latest.match(/\b(i'?m|i am|this is|my name'?s|name is)\s+([A-Z][a-z]+)/);
  if (m) name = m[2];

  return { inScope, slots, name, source: "mock" };
}

const MOCK_QUESTIONS: Record<SlotKey, string> = {
  need: "Happy to help. What are you looking to build, and what's the project?",
  timeline: "Got it. When do you need this live, or is there a deadline you're working to?",
  budget: "Makes sense. Do you have a budget range in mind for the work?",
  authority: "Great. And are you the decision-maker on this, or would others be involved in signing off?",
};

function mockCompose(lead: Lead, action: ComposeAction): string {
  switch (action.kind) {
    case "ask":
      return MOCK_QUESTIONS[action.slot];
    case "handoff":
      return "That's a strong fit, so I'm passing you to the team now. They've got everything you've told me, so you won't need to repeat yourself. They'll be with you shortly.";
    case "close":
      return "Thanks so much for the details. The team will take a look and follow up if it's the right fit. In the meantime feel free to browse our recent work on the site.";
    case "redirect":
      return `That's a little outside what I can help with here. I'm just the ${config.agencyName} assistant for project enquiries. Tell me a bit about what you're looking to build?`;
  }
}
