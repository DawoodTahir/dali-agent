import { Lead } from "../types";
import { ScorePanel, StatusPill } from "./ScorePanel";

export function Transcript({ lead }: { lead: Lead | null }) {
  if (!lead) {
    return <div className="tr-empty mono">Select a lead to see the conversation.</div>;
  }
  return (
    <div className="card transcript">
      <div className="tr-head">
        <div>
          <div className="tr-name">{lead.name || lead.contact}</div>
          <div className="tr-sub mono">
            {lead.channel} · {lead.contact}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <StatusPill status={lead.status} />
        </div>
      </div>

      <div className="tr-grid">
        <div className="tr-thread">
          {lead.messages.map((m, i) =>
            m.role === "system" ? (
              <div key={i} className="sys">{m.text}</div>
            ) : (
              <div key={i} className={`bubble ${m.role === "lead" ? "in" : "out"}`}>
                <span className="who">{m.role}</span>
                {m.text}
              </div>
            )
          )}
          {lead.handedOff && <div className="handoff mono">→ handed off to the team</div>}
        </div>

        <div className="tr-side">
          <ScorePanel score={lead.score} slots={lead.slots} status={lead.status} />
        </div>
      </div>
    </div>
  );
}
