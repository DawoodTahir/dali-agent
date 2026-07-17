import { Lead, Stats, Trace } from "./types";

const API = (import.meta.env.VITE_API_URL as string | undefined) || "";

export interface Health {
  ok: boolean;
  agency: string;
  /** The model id when live, or the literal "mock" when no key is configured. */
  llm: string;
  /** Non-null once a real call has failed and fallen back to the mock. */
  llmError: string | null;
  whatsapp: string;
  thresholds: { qualify: number; disqualify: number };
}

export interface SimulateResponse {
  reply: string;
  action: string;
  trace: Trace;
  lead: Pick<Lead, "id" | "name" | "status" | "score" | "slots" | "messages">;
}

export async function simulate(
  sessionId: string,
  text: string,
  name?: string
): Promise<SimulateResponse> {
  const res = await fetch(`${API}/api/simulate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, text, name }),
  });
  if (!res.ok) throw new Error(`simulate failed: ${res.status}`);
  return res.json();
}

export async function getLeads(): Promise<{ leads: Lead[]; stats: Stats }> {
  const res = await fetch(`${API}/api/leads`);
  if (!res.ok) throw new Error(`getLeads failed: ${res.status}`);
  return res.json();
}

export async function getHealth(): Promise<Health> {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error(`health failed: ${res.status}`);
  return res.json();
}

export function streamUrl(): string {
  return `${API}/api/leads/stream`;
}
