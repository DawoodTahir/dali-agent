export type SlotKey = "need" | "timeline" | "budget" | "authority";

export const SLOT_ORDER: SlotKey[] = ["need", "timeline", "budget", "authority"];

// Weights sum to 100. Budget and authority weigh most — they decide "worth a call".
export const SLOT_WEIGHTS: Record<SlotKey, number> = {
  need: 20,
  timeline: 20,
  budget: 35,
  authority: 25,
};

export interface Slot {
  value: string | null;
  filled: boolean;
}

export type Slots = Record<SlotKey, Slot>;

export type Channel = "simulator" | "whatsapp";

export type LeadStatus = "active" | "qualified" | "disqualified" | "closed";

export type Role = "lead" | "agent" | "system";

/** Which brain produced a reply: the real model, or the offline mock fallback. */
export type LlmSource = "claude" | "mock";

export interface Message {
  role: Role;
  text: string;
  ts: number;
  /** Set on agent messages only — lets the UI prove a reply came from real Claude. */
  source?: LlmSource;
}

/**
 * A per-turn record of what the engine did, in graph order. Purely observational —
 * the decision itself still lives in scoring.ts. Returned to the Simulator so the
 * pipeline is visible rather than implied.
 */
export interface Trace {
  inScope: boolean;
  /** Slots that went from empty → filled on THIS turn. */
  extracted: SlotKey[];
  scoreBefore: number;
  scoreAfter: number;
  action: "ask" | "handoff" | "close" | "redirect";
  /** The slot being asked about, when action is "ask". */
  askedFor: SlotKey | null;
  source: LlmSource;
  ms: number;
}

export interface Lead {
  id: string;
  channel: Channel;
  contact: string; // phone number or simulator session id
  name: string | null;
  status: LeadStatus;
  score: number;
  slots: Slots;
  messages: Message[];
  disclosed: boolean; // AI disclosure already sent
  handedOff: boolean;
  offTopicStreak: number;
  createdAt: number;
  updatedAt: number;
}

export function emptySlots(): Slots {
  return {
    need: { value: null, filled: false },
    timeline: { value: null, filled: false },
    budget: { value: null, filled: false },
    authority: { value: null, filled: false },
  };
}
