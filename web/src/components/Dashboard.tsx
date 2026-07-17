import { useEffect, useRef, useState } from "react";
import { getLeads, streamUrl } from "../api";
import { Lead, Stats } from "../types";
import { LeadList } from "./LeadList";
import { Transcript } from "./Transcript";

const emptyStats: Stats = { total: 0, qualified: 0, active: 0, disqualified: 0 };

export function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  function upsert(lead: Lead) {
    setLeads((prev) => {
      const rest = prev.filter((l) => l.id !== lead.id);
      return [lead, ...rest].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }

  useEffect(() => {
    getLeads()
      .then(({ leads, stats }) => {
        setLeads(leads);
        setStats(stats);
        if (!selectedId && leads[0]) setSelectedId(leads[0].id);
      })
      .catch(() => {});

    // Live updates via SSE. Falls back silently to the initial load if unsupported.
    const es = new EventSource(streamUrl());
    esRef.current = es;
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("snapshot", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setLeads(d.leads);
      setStats(d.stats);
    });
    es.addEventListener("lead", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      upsert(d.lead);
      setStats(d.stats);
    });

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = leads.find((l) => l.id === selectedId) || null;

  return (
    <div className="dash">
      <div className="dash-stats">
        <Stat label="Total leads" value={stats.total} />
        <Stat label="Qualified" value={stats.qualified} tone="hot" />
        <Stat label="In progress" value={stats.active} tone="warm" />
        <Stat label="Closed out" value={stats.disqualified} />
        <div className="live-flag">
          <span className={`chip ${live ? "live" : "plain"}`}>
            <span className={`dot ${live ? "pulse" : ""}`} />
            {live ? "live" : "reconnecting"}
          </span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-left">
          <div className="panel-k mono">Leads</div>
          <LeadList leads={leads} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="dash-right">
          <Transcript lead={selected} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card stat">
      <div className={`stat-v num ${tone || ""}`}>{value}</div>
      <div className="stat-l">{label}</div>
    </div>
  );
}
