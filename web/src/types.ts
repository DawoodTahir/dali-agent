// Mirrors server/src/types.ts on purpose (no shared package — simpler hosting).
// If you edit the Lead/Slot/Trace shape, edit it in both places.

export type SlotKey = "need" | "timeline" | "budget" | "authority";

export interface Slot {
  value: string | null;
  filled: boolean;
}
export type Slots = Record<SlotKey, Slot>;

export type LeadStatus = "active" | "qualified" | "disqualified" | "closed";
export type Channel = "simulator" | "whatsapp";

/** Which brain produced a reply: the real model, or the offline mock fallback. */
export type LlmSource = "claude" | "mock";

export interface Message {
  role: "lead" | "agent" | "system";
  text: string;
  ts: number;
  /** Set on agent messages only — lets the UI prove a reply came from real Claude. */
  source?: LlmSource;
}

/** A per-turn record of what the engine did, in graph order. */
export interface Trace {
  inScope: boolean;
  extracted: SlotKey[];
  scoreBefore: number;
  scoreAfter: number;
  action: "ask" | "handoff" | "close" | "redirect";
  askedFor: SlotKey | null;
  source: LlmSource;
  ms: number;
}

export interface Lead {
  id: string;
  channel: Channel;
  contact: string;
  name: string | null;
  status: LeadStatus;
  score: number;
  slots: Slots;
  messages: Message[];
  disclosed: boolean;
  handedOff: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Stats {
  total: number;
  qualified: number;
  active: number;
  disqualified: number;
}

export const SLOT_ORDER: SlotKey[] = ["need", "timeline", "budget", "authority"];

export const SLOT_LABEL: Record<SlotKey, string> = {
  need: "Need",
  timeline: "Timeline",
  budget: "Budget",
  authority: "Authority",
};

/** Kept in sync with SLOT_WEIGHTS in server/src/types.ts. Must sum to 100. */
export const SLOT_WEIGHT: Record<SlotKey, number> = {
  need: 20,
  timeline: 20,
  budget: 35,
  authority: 25,
};

/** What each slot is actually asking, in plain language — for the pitch audience. */
export const SLOT_ASKS: Record<SlotKey, string> = {
  need: "Is it work we do?",
  timeline: "Is it real, and soon?",
  budget: "Can they afford it?",
  authority: "Can they say yes?",
};
