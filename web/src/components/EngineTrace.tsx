import { SLOT_LABEL, Trace } from "../types";

/**
 * Renders the last turn as the five engine stages, in graph order.
 *
 * The `code` / `claude` badges are the point: SCORE and DECIDE are plain
 * arithmetic in scoring.ts, and the panel says so on every single turn.
 */
export function EngineTrace({ trace, busy }: { trace: Trace | null; busy: boolean }) {
  return (
    <div className="card trace">
      <div className="trace-head">
        <span className="k">Engine · last turn</span>
        {busy && <span className="chip plain"><span className="dot pulse" />running</span>}
      </div>

      {!trace ? (
        <p className="trace-idle">
          Send a message and the pipeline for that turn appears here — what was
          extracted, what it scored, and who decided.
        </p>
      ) : (
        <>
          <ul className="stages">
            <Stage k="Guardrail" on badge="claude">
              {trace.inScope ? (
                "In scope — a project enquiry"
              ) : (
                <span className="off">Off topic — redirecting, not answering</span>
              )}
            </Stage>

            <Stage k="Extract" on={trace.extracted.length > 0} badge="claude">
              {trace.extracted.length > 0 ? (
                trace.extracted.map((s) => (
                  <span key={s} className="tag">+{SLOT_LABEL[s]}</span>
                ))
              ) : (
                <span className="tag none">nothing new</span>
              )}
            </Stage>

            <Stage k="Score" on={trace.scoreAfter !== trace.scoreBefore} badge="code">
              <span className="num">
                {trace.scoreBefore} → <strong>{trace.scoreAfter}</strong>
              </span>
            </Stage>

            <Stage k="Decide" on badge="code">
              {decisionText(trace)}
            </Stage>

            <Stage k="Compose" on badge="claude">
              {composeText(trace)}
            </Stage>
          </ul>

          <div className="trace-foot">
            <span className={`src ${trace.source}`}>
              {trace.source === "claude" ? "real claude" : "mock"}
            </span>
            <span className="num">{trace.ms} ms</span>
          </div>
        </>
      )}
    </div>
  );
}

function Stage({
  k,
  on,
  badge,
  children,
}: {
  k: string;
  on?: boolean;
  badge: "code" | "claude";
  children: React.ReactNode;
}) {
  return (
    <li className={`stage ${on ? "on" : ""}`}>
      <span className="stage-k">{k}</span>
      <span className="stage-v">
        {children}
        <span className={`by ${badge === "code" ? "code" : "llm"}`}>
          {badge === "code" ? "code" : "claude"}
        </span>
      </span>
    </li>
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
