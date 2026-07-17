import { Lead, SLOT_ORDER, SLOT_WEIGHTS, SlotKey } from "../types";

/**
 * Score is plain, auditable arithmetic from filled slots — the CODE decides,
 * not the model. A filled slot contributes its full weight; weights sum to 100.
 */
export function scoreLead(lead: Lead): number {
  let s = 0;
  for (const key of SLOT_ORDER) {
    if (lead.slots[key].filled) s += SLOT_WEIGHTS[key];
  }
  return s;
}

export function nextUnfilledSlot(lead: Lead): SlotKey | null {
  for (const key of SLOT_ORDER) {
    if (!lead.slots[key].filled) return key;
  }
  return null;
}

export function filledCount(lead: Lead): number {
  return SLOT_ORDER.filter((k) => lead.slots[k].filled).length;
}
