import { useEffect, useRef, useState } from "react";
import { simulate } from "../api";
import { Message, Slots, LeadStatus, SlotKey, Trace } from "../types";
import { ScorePanel } from "./ScorePanel";
import { EngineTrace } from "./EngineTrace";

const emptySlots: Slots = {
  need: { value: null, filled: false },
  timeline: { value: null, filled: false },
  budget: { value: null, filled: false },
  authority: { value: null, filled: false },
};

function newSession() {
  return "sim-" + Math.random().toString(36).slice(2, 10);
}

/**
 * One-click leads, each exercising a different branch of the engine. Having all
 * three outcomes a click away means the whole story is demoable without typing.
 * The lead's opening line is scripted; every reply is the real engine.
 */
interface Persona {
  name: string;
  opener: string;
  outcome: string;
  icon: string;
  kind: "qualified" | "closed" | "redirect";
}

const PERSONAS: Persona[] = [
  {
    name: "Founder, funded, ready",
    opener:
      "Hi, saw your work for Ollie. We're launching a skincare line and need a full brand identity. Want it live by October, budget's 25-30k. I'm the founder so it's my call.",
    outcome: "clears the bar, hands off",
    icon: "◆",
    kind: "qualified",
  },
  {
    name: "Vague enquiry",
    opener: "Hey, do you guys do branding?",
    outcome: "agent works the slots one question at a time",
    icon: "◇",
    kind: "qualified",
  },
  {
    name: "Curious, no budget",
    opener:
      "Just looking around really. Might rebrand at some point, no timeline. Not sure we'd have money for it and I'd have to ask my boss anyway.",
    outcome: "scores low, closes politely",
    icon: "○",
    kind: "closed",
  },
  {
    name: "Off-topic wanderer",
    opener: "Write me a poem about the weather in Lisbon",
    outcome: "guardrail redirects, doesn't answer",
    icon: "✕",
    kind: "redirect",
  },
];

export function Simulator() {
  const [sessionId, setSessionId] = useState(newSession);
  const [messages, setMessages] = useState<Message[]>([]);
  const [slots, setSlots] = useState<Slots>(emptySlots);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<LeadStatus>("active");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [justFilled, setJustFilled] = useState<SlotKey[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Clear the slot-fill flash after the animation has played.
  useEffect(() => {
    if (justFilled.length === 0) return;
    const t = setTimeout(() => setJustFilled([]), 1200);
    return () => clearTimeout(t);
  }, [justFilled]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    // optimistic: show the lead's own message immediately
    setMessages((m) => [...m, { role: "lead", text: t, ts: Date.now() }]);
    setBusy(true);
    try {
      const res = await simulate(sessionId, t);
      // server transcript is authoritative
      setMessages(res.lead.messages);
      setSlots(res.lead.slots);
      setScore(res.lead.score);
      setStatus(res.lead.status);
      setTrace(res.trace);
      setJustFilled(res.trace.extracted);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "system", text: "⚠ backend unreachable. Is the server running on :8080?", ts: Date.now() },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSessionId(newSession());
    setMessages([]);
    setSlots(emptySlots);
    setScore(0);
    setStatus("active");
    setTrace(null);
    setJustFilled([]);
    setInput("");
  }

  const done = status !== "active";

  const phone = (
    <div className="phone">
      <div className="phone-head">
        <div className="ph-avatar">D</div>
        <div>
          <div className="ph-name">DALI Agency</div>
          <div className="ph-sub mono">business account · you are the lead</div>
        </div>
        <button className="reset" onClick={reset} title="Start a new conversation">
          new lead
        </button>
      </div>

      <div className="thread" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty">
            <p className="empty-lede">You're the inbound lead. Pick someone to play,</p>
            <p className="empty-sub">or just start typing at the bottom.</p>
            <div className="personas">
              {PERSONAS.map((p) => (
                <button
                  key={p.name}
                  className="persona"
                  onClick={() => send(p.opener)}
                  disabled={busy}
                >
                  <span className={`persona-icon ${p.kind}`}>{p.icon}</span>
                  <span className="persona-body">
                    <span className="persona-name">{p.name}</span>
                    <span className="persona-line">“{p.opener}”</span>
                    <span className="persona-out">{p.outcome}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "system" ? (
            <div key={i} className="sys">{m.text}</div>
          ) : (
            <div key={i} className={`bubble ${m.role === "lead" ? "out" : "in"}`}>
              {m.text}
              <span className="meta">
                {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )
        )}

        {busy && (
          <div className="typing">
            <span></span><span></span><span></span>
          </div>
        )}
      </div>

      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder={done ? "Conversation complete. Hit “new lead” to run it again" : "Type as the lead…"}
          disabled={busy || done}
        />
        <button onClick={() => send(input)} disabled={busy || done || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="sim-head">
        <div>
          <h2>Play an inbound lead</h2>
          <p>
            Pick a persona or type. Watch the engine decide.{" "}
            <strong>The code scores and hands off; the model only extracts and phrases.</strong>
          </p>
        </div>
        <ul className="sim-facts">
          <li><span className="fact-v">4</span><span className="fact-k">signals scored</span></li>
          <li><span className="fact-v">75</span><span className="fact-k">handoff bar</span></li>
          <li><span className="fact-v">2</span><span className="fact-k">AI calls / turn</span></li>
        </ul>
      </div>

      <div className="sim">
        <div className="sim-phone-cell">{phone}</div>
        <aside className="sim-side">
          <ScorePanel score={score} slots={slots} status={status} justFilled={justFilled} />
          <EngineTrace trace={trace} busy={busy} />
        </aside>
      </div>
    </>
  );
}
