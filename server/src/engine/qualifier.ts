import { config } from "../config";
import { saveLead } from "../store";
import { Lead, LlmSource, SLOT_ORDER, SlotKey, Trace } from "../types";
import { analyze, compose } from "./llm";
import { ComposeAction, DISCLOSURE } from "./prompts";
import { filledCount, nextUnfilledSlot, scoreLead } from "./scoring";

export interface TurnResult {
  reply: string;
  lead: Lead;
  action: ComposeAction["kind"];
  trace: Trace;
}

/**
 * Process one inbound lead message end-to-end and return the agent's reply.
 * Graph: guardrail -> extract -> score -> decide -> compose.
 * Mutates + persists the lead.
 */
export async function handleInbound(lead: Lead, text: string): Promise<TurnResult> {
  const startedAt = Date.now();
  const scoreBefore = lead.score;

  lead.messages.push({ role: "lead", text, ts: Date.now() });

  // If already handed off or closed, don't keep qualifying — stay quiet-ish.
  if (lead.status === "qualified" || lead.status === "disqualified" || lead.status === "closed") {
    const reply =
      lead.status === "qualified"
        ? "You're all set. The team has your details and will be in touch. "
        : "Thanks, the team has what they need for now. ";
    lead.messages.push({ role: "agent", text: reply, ts: Date.now(), source: "mock" });
    saveLead(lead);
    return {
      reply,
      lead,
      action: "close",
      trace: {
        inScope: true,
        extracted: [],
        scoreBefore,
        scoreAfter: lead.score,
        action: "close",
        askedFor: null,
        source: "mock",
        ms: Date.now() - startedAt,
      },
    };
  }

  // 1) EXTRACT + guardrail (single analysis call)
  const analysis = await analyze(lead, text);

  if (analysis.name && !lead.name) lead.name = analysis.name;

  // 2) apply extracted slots (only fill, never overwrite a filled slot)
  const extracted: SlotKey[] = [];
  for (const key of SLOT_ORDER) {
    const v = analysis.slots[key];
    if (v && !lead.slots[key].filled) {
      lead.slots[key] = { value: String(v), filled: true };
      extracted.push(key);
    }
  }

  // 3) SCORE (deterministic)
  lead.score = scoreLead(lead);

  // 4) DECIDE
  let action: ComposeAction;

  if (!analysis.inScope) {
    lead.offTopicStreak += 1;
    // Two strikes with no useful info and we wind it down gracefully.
    if (lead.offTopicStreak >= 3 && filledCount(lead) === 0) {
      action = { kind: "close" };
      lead.status = "closed";
    } else {
      action = { kind: "redirect" };
    }
  } else {
    lead.offTopicStreak = 0;

    if (lead.score >= config.qualifyThreshold) {
      action = { kind: "handoff" };
      lead.status = "qualified";
      lead.handedOff = true;
    } else {
      const next = nextUnfilledSlot(lead);
      const leadTurns = lead.messages.filter((m) => m.role === "lead").length;

      if (next === null || leadTurns >= 8) {
        // Slots exhausted (or conversation dragging) and not qualified.
        if (lead.score < config.disqualifyThreshold) {
          action = { kind: "close" };
          lead.status = "disqualified";
        } else {
          // Enough signal to be worth a human even if not a slam dunk.
          action = { kind: "handoff" };
          lead.status = "qualified";
          lead.handedOff = true;
        }
      } else {
        action = { kind: "ask", slot: next as SlotKey };
      }
    }
  }

  // 5) COMPOSE
  const composed = await compose(lead, action);
  let reply = composed.text;

  // If either call fell back, the turn as a whole wasn't pure Claude — say so.
  const source: LlmSource =
    analysis.source === "claude" && composed.source === "claude" ? "claude" : "mock";

  // AI disclosure goes on the very first agent message, in code (not left to the model).
  if (!lead.disclosed) {
    reply = DISCLOSURE + reply;
    lead.disclosed = true;
  }

  lead.messages.push({ role: "agent", text: reply, ts: Date.now(), source });
  saveLead(lead);

  return {
    reply,
    lead,
    action: action.kind,
    trace: {
      inScope: analysis.inScope,
      extracted,
      scoreBefore,
      scoreAfter: lead.score,
      action: action.kind,
      askedFor: action.kind === "ask" ? action.slot : null,
      source,
      ms: Date.now() - startedAt,
    },
  };
}
