import { SLOT_LABEL, SlotKey, Trace } from "../types";

/**
 * Renders the last turn as the five engine stages, in graph order.
 *
 * The `code` / `claude` badges are the point: SCORE and DECIDE are plain
 * arithmetic in scoring.ts, and the panel says so on every single turn.
 *
 * `horizontal` renders the same data as a full-width pipeline strip — used by
 * the Simulator's "Pipeline" layout to make the trace the hero of the view.
 */

type Badge = "code" | "claude";

interface StageData {
  k: string;
  on: boolean;
  badge: Badge;
  kind: "text" | "tags";
  text?: string;
  off?: boolean;
  tags?: SlotKey[];
}

function buildStages(trace: Trace): StageData[] {
  return [
    {
      k: "Guardrail",
      on: true,
      badge: "claude",
      kind: "text",
      text: trace.inScope ? "In scope — a project enquiry" : "Off topic — redirecting, not answering",
      off: !trace.inScope,
    },
    {
      k: "Extract",
      on: trace.extracted.length > 0,
      badge: "claude",
      kind: "tags",
      tags: trace.extracted,
    },
    {
      k: "Score",
      on: trace.scoreAfter !== trace.scoreBefore,
      badge: "code",
      kind: "text",
      text: `${trace.scoreBefore} → ${trace.scoreAfter}`,
    },
    {
      k: "Decide",
      on: true,
      badge: "code",
      kind: "text",
      text: decisionText(trace),
    },
    {
      k: "Compose",
      on: true,
      badge: "claude",
      kind: "text",
      text: composeText(trace),
    },
  ];
}

function StageBadge({ badge }: { badge: Badge }) {
  return <span className={`by ${badge === "code" ? "code" : "llm"}`}>{badge === "code" ? "code" : "claude"}</span>;
}

function StageValue({ s }: { s: StageData }) {
  if (s.kind === "tags") {
    return s.tags && s.tags.length > 0 ? (
      <>{s.tags.map((t) => <span key={t} className="tag">+{SLOT_LABEL[t]}</span>)}</>
    ) : (
      <span className="tag none">nothing new</span>
    );
  }
  return <span className={s.off ? "off" : undefined}>{s.text}</span>;
}

export function EngineTrace({
  trace,
  busy,
  horizontal = false,
}: {
  trace: Trace | null;
  busy: boolean;
  horizontal?: boolean;
}) {
  const stages = trace ? buildStages(trace) : [];

  return (
    <div className={`card trace ${horizontal ? "hero" : ""}`}>
      <div className="trace-head">
        <span className="k">Engine trace · last turn</span>
        {busy && <span className="chip plain"><span className="dot pulse" />running</span>}
      </div>

      <div className="trace-legend mono">
        <span><span className="by code">code</span> decides</span>
        <span><span className="by llm">claude</span> extracts &amp; phrases</span>
      </div>

      {!trace ? (
        <p className="trace-idle">
          Send a message and the pipeline for that turn appears here — what was
          extracted, what it scored, and who decided.
        </p>
      ) : horizontal ? (
        <>
          <div className="pipeline-strip">
            {stages.map((s, i) => (
              <div className="pstage-wrap" key={s.k}>
                <div className={`stage-card ${s.on ? "on" : ""}`}>
                  <div className="stage-card-head">
                    <span className="stage-k">{s.k}</span>
                    <StageBadge badge={s.badge} />
                  </div>
                  <span className="stage-v"><StageValue s={s} /></span>
                </div>
                {i < stages.length - 1 && (
                  <svg className="stage-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <TraceFoot trace={trace} />
        </>
      ) : (
        <>
          <ul className="stages">
            {stages.map((s) => (
              <li className={`stage ${s.on ? "on" : ""}`} key={s.k}>
                <span className="stage-k">{s.k}</span>
                <span className="stage-v">
                  <StageValue s={s} />
                  <StageBadge badge={s.badge} />
                </span>
              </li>
            ))}
          </ul>
          <TraceFoot trace={trace} />
        </>
      )}
    </div>
  );
}

function TraceFoot({ trace }: { trace: Trace }) {
  return (
    <div className="trace-foot">
      <span className={`src ${trace.source}`}>{trace.source === "claude" ? "real claude" : "mock fallback"}</span>
      <span className="num">{trace.ms} ms</span>
    </div>
  );
}

function decisionText(trace: Trace): string {
  switch (trace.action) {
    case "ask":
      return trace.askedFor ? `Ask for ${SLOT_LABEL[trace.askedFor].toLowerCase()}` : "Ask next question";
    case "handoff":
      return "Hand off to the team";
    case "close":
      return "Close politely";
    case "redirect":
      return "Steer back on topic";
  }
}

function composeText(trace: Trace): string {
  if (trace.source === "mock") return "Templated reply (mock fallback)";
  return "Wrote one short WhatsApp reply";
}
