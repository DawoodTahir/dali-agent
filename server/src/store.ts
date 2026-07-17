import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { Channel, Lead, emptySlots } from "./types";

/**
 * POC store: everything in memory. Single-instance only.
 * For production, replace this module with a Postgres-backed repo exposing
 * the same functions — the rest of the app depends only on this interface.
 */

const leads = new Map<string, Lead>();
// contact (channel:contact) -> lead id, so repeat messages continue one lead.
const byContact = new Map<string, string>();

export const events = new EventEmitter();
events.setMaxListeners(100);

function key(channel: Channel, contact: string) {
  return `${channel}:${contact}`;
}

export function getOrCreateLead(channel: Channel, contact: string, name?: string | null): Lead {
  const k = key(channel, contact);
  const existingId = byContact.get(k);
  if (existingId) {
    const lead = leads.get(existingId);
    if (lead) {
      if (name && !lead.name) lead.name = name;
      return lead;
    }
  }
  const now = Date.now();
  const lead: Lead = {
    id: randomUUID(),
    channel,
    contact,
    name: name ?? null,
    status: "active",
    score: 0,
    slots: emptySlots(),
    messages: [],
    disclosed: false,
    handedOff: false,
    offTopicStreak: 0,
    createdAt: now,
    updatedAt: now,
  };
  leads.set(lead.id, lead);
  byContact.set(k, lead.id);
  events.emit("lead", lead);
  return lead;
}

export function saveLead(lead: Lead) {
  lead.updatedAt = Date.now();
  leads.set(lead.id, lead);
  events.emit("lead", lead);
}

export function getLead(id: string): Lead | undefined {
  return leads.get(id);
}

export function listLeads(): Lead[] {
  return Array.from(leads.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function stats() {
  const all = listLeads();
  return {
    total: all.length,
    qualified: all.filter((l) => l.status === "qualified").length,
    active: all.filter((l) => l.status === "active").length,
    disqualified: all.filter((l) => l.status === "disqualified").length,
  };
}
