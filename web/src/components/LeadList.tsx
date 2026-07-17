import { Lead } from "../types";
import { StatusPill } from "./ScorePanel";

export function LeadList({
  leads,
  selectedId,
  onSelect,
}: {
  leads: Lead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (leads.length === 0) {
    return <div className="ll-empty mono">No leads yet. Qualify one in the Live chat tab.</div>;
  }
  return (
    <ul className="lead-list">
      {leads.map((l) => {
        const tone = l.score >= 75 ? "hot" : l.score >= 30 ? "warm" : "cold";
        return (
          <li
            key={l.id}
            className={l.id === selectedId ? "on" : ""}
            onClick={() => onSelect(l.id)}
          >
            <div className="ll-top">
              <span className="ll-name">{l.name || l.contact}</span>
              <span className={`ll-score ${tone}`}>{l.score}</span>
            </div>
            <div className="ll-bot">
              <span className={`chan ${l.channel}`}>{l.channel}</span>
              <StatusPill status={l.status} />
              <span className="ll-time mono">
                {new Date(l.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
