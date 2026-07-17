import { useEffect, useState } from "react";
import { Simulator } from "./components/Simulator";
import { Dashboard } from "./components/Dashboard";
import { getHealth, Health } from "./api";

type Tab = "simulator" | "dashboard";

export function App() {
  const [tab, setTab] = useState<Tab>("simulator");
  const [health, setHealth] = useState<Health | null>(null);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      getHealth()
        .then((h) => {
          if (!alive) return;
          setHealth(h);
          setReachable(true);
        })
        .catch(() => alive && setReachable(false));

    poll();
    // Re-poll so a mid-demo fallback (bad key, rate limit) surfaces on its own.
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // A configured key is NOT a working one. If the last real call fell back, the
  // chip must say so — otherwise it reads "live" while serving templated replies.
  const configured = !!health && health.llm !== "mock";
  const live = configured && !health!.llmError;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <div className="brand-name">DALI Qualifier</div>
            <div className="brand-sub">WhatsApp lead qualification · POC</div>
          </div>
        </div>

        <nav className="tabs">
          <button className={tab === "simulator" ? "tab on" : "tab"} onClick={() => setTab("simulator")}>
            Simulator
          </button>
          <button className={tab === "dashboard" ? "tab on" : "tab"} onClick={() => setTab("dashboard")}>
            Dashboard
          </button>
        </nav>

        <div className="health">
          {!reachable ? (
            <span className="chip off"><span className="dot" />backend offline</span>
          ) : !health ? null : (
            <>
              <span className={`chip ${live ? "live" : "mock"}`}>
                <span className={`dot ${live ? "pulse" : ""}`} />
                {live
                  ? health.llm
                  : configured
                    ? "falling back to mock"
                    : "mock LLM — no API key"}
              </span>
              <span className="chip plain">
                {health.whatsapp === "connected" ? "WhatsApp live" : "simulator only"}
              </span>
            </>
          )}
        </div>
      </header>

      <main className="main">
        {/* A real call failed and we quietly fell back. Never let that pass unnoticed mid-pitch. */}
        {health?.llmError && (
          <div className="fallback-banner">
            <strong>Replies are templated, not live.</strong>
            <span>The last call to Claude failed: {health.llmError}</span>
          </div>
        )}
        {tab === "simulator" ? <Simulator /> : <Dashboard />}
      </main>

      <footer className="foot mono">
        One engine drives both the Simulator and the real WhatsApp webhook · in-memory store, single instance
      </footer>
    </div>
  );
}
