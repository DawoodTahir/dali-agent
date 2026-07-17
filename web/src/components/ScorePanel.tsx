import { LeadStatus, SLOT_ASKS, SLOT_LABEL, SLOT_ORDER, SLOT_WEIGHT, SlotKey, Slots } from "../types";

const QUALIFY_AT = 75;

export function StatusPill({ status }: { status: LeadStatus }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

export function ScorePanel({
  score,
  slots,
  status,
  justFilled = [],
}: {
  score: number;
  slots: Slots;
  status: LeadStatus;
  /** Slots filled on the latest turn — flashed briefly to draw the eye. */
  justFilled?: SlotKey[];
}) {
  const tone = score >= QUALIFY_AT ? "hot" : score >= 30 ? "warm" : "cold";

  return (
    <div className="card score-panel">
      <div className="sp-head">
        <span className="k">Lead score</span>
        <StatusPill status={status} />
      </div>

      <div className="sp-read">
        <span className={`sp-num num ${tone}`}>{score}</span>
        <span className="sp-of num">/ 100</span>
      </div>

      <div className="sp-bar">
        <span style={{ width: `${Math.min(score, 100)}%` }} className={tone} />
        {/* The bar to clear, drawn where it actually sits. */}
        <span className="sp-mark" style={{ left: `${QUALIFY_AT}%` }} />
      </div>
      <div className="sp-scale">
        <span>0</span>
        <span>hand off at {QUALIFY_AT} →</span>
      </div>

      <ul className="slots">
        {SLOT_ORDER.map((k) => {
          const s = slots[k];
          return (
            <li
              key={k}
              className={`${s.filled ? "filled" : ""} ${justFilled.includes(k) ? "just" : ""}`}
            >
              <span className="s-k">{SLOT_LABEL[k]}</span>
              <span className="s-w">+{SLOT_WEIGHT[k]}</span>
              <span className="s-v">{s.filled ? s.value || "captured" : SLOT_ASKS[k]}</span>
            </li>
          );
        })}
      </ul>

      <p className="sp-note mono">
        Weights sum to 100 and live in config. The score is arithmetic — no model
        involved in the handoff call.
      </p>
    </div>
  );
}
