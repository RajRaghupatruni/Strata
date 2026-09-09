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
import { PUBLIC_DEMO_MESSAGE, usePublicDemoReadOnly } from "../services/api/demoMode";

const links = [
  { to: "/", label: "Home", hotkey: "1", summary: "What matters now", icon: "⌂" },
  { to: "/matches", label: "Matches", hotkey: "2", summary: "Browse history", icon: "◫" },
  { to: "/insights", label: "Insights", hotkey: "3", summary: "Read the trend", icon: "⌁" },
  { to: "/review", label: "Review", hotkey: "4", summary: "Tag the cause", icon: "⊞" },
  { to: "/coach", label: "Coach", hotkey: "5", summary: "Plan the session", icon: "♧" },
  { to: "/progress", label: "Progress", hotkey: "6", summary: "Close the loop", icon: "↗" },
  { to: "/settings", label: "Settings", hotkey: "7", summary: "Player context", icon: "⚙" }
];

function Brand() {
  return (
    <div className="brand-mark">
      <div className="brand-glyph" aria-hidden="true">
        S
      </div>
      <div>
        <p className="brand-title">Strata</p>
        <p className="brand-subtitle">Performance intelligence</p>
      </div>
    </div>
  );
}

function Navigation() {
  return (
    <nav className="nav-list" aria-label="Primary navigation">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
        >
          <span className="nav-item-copy">
            <span className="nav-icon" aria-hidden="true">{link.icon}</span>
            <span>
            <span className="nav-label">{link.label}</span>
            <span className="nav-summary">{link.summary}</span>
            </span>
          </span>
          <span className="kbd" aria-label={`Alt ${link.hotkey}`}>
            {link.hotkey}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

function AppShell() {
  const readOnly = usePublicDemoReadOnly();
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
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }
      const link = links.find((item) => item.hotkey === event.key);
      if (!link) return;
      event.preventDefault();
      navigate(link.to);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <div className="app-canvas">
      <div className="app-layout">
        <aside className="app-sidebar">
          <div>
            <Brand />
            <Navigation />
          </div>
          <div className="sidebar-note">
            <p className="label">The Strata loop</p>
            <p className="microcopy mt-2">Better players build with data. Turn your games into growth.</p>
          </div>
        </aside>

        <div className="app-main">
          <header className="mobile-topbar">
            <Brand />
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open navigation"
              aria-expanded={isMenuOpen}
            >
              Menu
            </button>
          </header>

          {isMenuOpen && (
            <div className="mobile-menu">
              <aside className="mobile-menu-panel">
                <div className="flex items-center justify-between gap-3">
                  <Brand />
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <Navigation />
              </aside>
              <button
                type="button"
                className="mobile-menu-backdrop"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close navigation"
              />
            </div>
          )}

          <main className="page">
            {readOnly && (
              <div className="surface-subtle p-4 mb-5" role="status">
                <p className="label">Public demo · Read-only</p>
                <p className="section-copy">{PUBLIC_DEMO_MESSAGE}</p>
              </div>
            )}
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
