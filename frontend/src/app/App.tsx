import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate
} from "react-router-dom";

import { CoachPage } from "../features/coach/CoachPage";
import { HomePage } from "../features/home/HomePage";
import { InsightsPage } from "../features/insights/InsightsPage";
import { MatchesPage } from "../features/matches/MatchesPage";
import { ProgressPage } from "../features/progress/ProgressPage";
import { ReviewPage } from "../features/review/ReviewPage";
import { SettingsPage } from "../features/settings/SettingsPage";

const links = [
  { to: "/", label: "Home", hotkey: "1", summary: "Command Center" },
  { to: "/matches", label: "Matches", hotkey: "2", summary: "Live Match Vault" },
  { to: "/insights", label: "Insights", hotkey: "3", summary: "Trend Intelligence" },
  { to: "/review", label: "Review", hotkey: "4", summary: "Round Breakdown" },
  { to: "/coach", label: "Coach", hotkey: "5", summary: "Action Plan Engine" },
  { to: "/progress", label: "Progress", hotkey: "6", summary: "Improvement Delta" },
  { to: "/settings", label: "Settings", hotkey: "7", summary: "Profile + Context" }
];

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const link = links.find((item) => item.hotkey === event.key);
      if (!link) return;
      event.preventDefault();
      navigate(link.to);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <div className="min-h-screen strata-background text-stone-100">
      <div className="strata-atmo" aria-hidden="true" />
      <div className="strata-grid-overlay" aria-hidden="true" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1420px] flex-col px-4 pb-6 pt-4 md:px-6">
        <header className="strata-topbar strata-fade-in">
          <button
            className="strata-burger strata-burger-float md:hidden"
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation"
            aria-expanded={isMenuOpen}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="strata-brand-block strata-brand-centered">
            <p className="strata-brand-kicker">Strata</p>
            <div className="strata-title-divider" aria-hidden="true" />
            <p className="strata-brand-subline">Rank Up, Smarter.</p>
          </div>
        </header>

        <div className="mt-4 grid flex-1 gap-4 md:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="strata-sidebar hidden md:flex">
            <div className="space-y-1">
              <p className="px-2 text-[0.63rem] uppercase tracking-[0.22em] text-stone-500">
                Navigation
              </p>
              <nav className="space-y-1">
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/"}
                    className={({ isActive }) =>
                      `strata-side-link ${isActive ? "strata-side-link-active" : "strata-side-link-idle"}`
                    }
                  >
                    <div>
                      <p className="text-sm font-medium">{link.label}</p>
                      <p className="text-[0.67rem] text-stone-400">{link.summary}</p>
                    </div>
                    <span className="strata-kbd">{link.hotkey}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="strata-sidebar-note">
              <p className="text-[0.62rem] uppercase tracking-[0.2em] text-stone-500">
                Live Workflow
              </p>
              <p className="mt-2 text-xs text-stone-300">
                Import Riot matches, review patterns, generate coaching, track progress.
              </p>
            </div>
          </aside>

          {isMenuOpen && (
            <div className="md:hidden">
              <button
                type="button"
                className="strata-mobile-backdrop"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close navigation"
              />
              <aside className="strata-mobile-drawer">
                <p className="px-2 text-[0.63rem] uppercase tracking-[0.22em] text-stone-500">
                  Navigate
                </p>
                <nav className="mt-2 space-y-1">
                  {links.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to === "/"}
                      className={({ isActive }) =>
                        `strata-side-link ${isActive ? "strata-side-link-active" : "strata-side-link-idle"}`
                      }
                    >
                      <div>
                        <p className="text-sm font-medium">{link.label}</p>
                        <p className="text-[0.67rem] text-stone-400">{link.summary}</p>
                      </div>
                      <span className="strata-kbd">{link.hotkey}</span>
                    </NavLink>
                  ))}
                </nav>
              </aside>
            </div>
          )}

          <main className="strata-main-frame strata-fade-in">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/coach" element={<CoachPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}
