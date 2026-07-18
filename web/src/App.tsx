import { useEffect, useState } from "react";
import { Simulator } from "./components/Simulator";
import { Dashboard } from "./components/Dashboard";
import { getHealth } from "./api";

type Tab = "simulator" | "dashboard";
type Theme = "light" | "dark";

export function App() {
  const [tab, setTab] = useState<Tab>("simulator");
  const [theme, setTheme] = useState<Theme>("light");
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let alive = true;
    // Light reachability ping so a down backend is visible; nothing else.
    const poll = () =>
      getHealth()
        .then(() => alive && setReachable(true))
        .catch(() => alive && setReachable(false));

    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="app" data-theme={theme}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <div className="brand-name">
              DALI Qualifier <span className="beta">Beta</span>
            </div>
            <div className="brand-sub">WhatsApp lead qualification agent</div>
          </div>
        </div>

        <nav className="tabs">
          <button className={tab === "simulator" ? "tab on" : "tab"} onClick={() => setTab("simulator")}>
            Live chat
          </button>
          <button className={tab === "dashboard" ? "tab on" : "tab"} onClick={() => setTab("dashboard")}>
            Dashboard
          </button>
        </nav>

        <div className="health">
          <button
            className="theme-toggle"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
              </svg>
            )}
          </button>

          {!reachable && (
            <span className="chip off"><span className="dot" />backend offline</span>
          )}
        </div>
      </header>

      <main className="main">
        {tab === "simulator" ? <Simulator /> : <Dashboard />}
      </main>

      <footer className="foot mono">
        One engine drives both Live chat and the real WhatsApp webhook · in-memory store, single instance
      </footer>
    </div>
  );
}
