import type { ReactNode } from "react";

type VisualKind = "agent" | "map" | "role" | "metric";

const agentTones: Record<string, string> = {
  jett: "agent-tone-cyan",
  omen: "agent-tone-violet",
  sova: "agent-tone-blue",
  killjoy: "agent-tone-amber",
  sage: "agent-tone-teal",
  reyna: "agent-tone-magenta",
  raze: "agent-tone-orange",
  cypher: "agent-tone-slate"
};

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : value.slice(0, 2)).toUpperCase();
}

function symbol(kind: VisualKind, value: string) {
  if (kind === "role") {
    const role = value.toLowerCase();
    if (role.includes("duelist")) return "✦";
    if (role.includes("controller")) return "◒";
    if (role.includes("initiator")) return "⌁";
    if (role.includes("sentinel")) return "◇";
    return "＋";
  }
  if (kind === "map") return "⌖";
  if (kind === "metric") return value;
  return initials(value);
}

export function GameVisual({ kind, value, size = "sm", children }: { kind: VisualKind; value?: string | null; size?: "sm" | "md"; children?: ReactNode }) {
  const label = value?.trim() || (kind === "agent" ? "Unknown agent" : kind === "map" ? "Unknown map" : "Unknown role");
  const tone = kind === "agent" ? (agentTones[label.toLowerCase()] ?? "agent-tone-slate") : "";
  return <span className={`game-visual game-visual-${kind} game-visual-${size} ${tone}`} title={label} aria-label={label}>{symbol(kind, label)}{children}</span>;
}

/** Compact game identity used where the repository has no licensed portrait asset. */
export function AgentAvatar({ agent, size = "sm" }: { agent?: string | null; size?: "sm" | "md" }) {
  return <GameVisual kind="agent" value={agent} size={size} />;
}

export function MapBadge({ map, size = "sm" }: { map?: string | null; size?: "sm" | "md" }) {
  return <GameVisual kind="map" value={map} size={size} />;
}

export function MetricIcon({ metric: metricName, size = "sm" }: { metric: "win" | "acs" | "kd" | "rr" | "evidence"; size?: "sm" | "md" }) {
  const labels: Record<string, string> = { win: "Win rate", acs: "Combat score", kd: "Kill death ratio", rr: "Rank rating", evidence: "Evidence" };
  return <span className={`metric-icon metric-icon-${metricName} metric-icon-${size}`} title={labels[metricName]} aria-label={labels[metricName]}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{metricName === "win" && <><path d="M5 4h14l-1.3 5.8A6.8 6.8 0 0 1 12 15a6.8 6.8 0 0 1-5.7-5.2L5 4Z"/><path d="M8 20h8M12 15v5M5 7H3v1a4 4 0 0 0 4 4M19 7h2v1a4 4 0 0 1-4 4"/></>}{metricName === "acs" && <><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>}{metricName === "kd" && <><path d="m7 4 4 4-3 3 4 4-3 3"/><path d="m17 4-4 4 3 3-4 4 3 3"/></>}{metricName === "rr" && <><path d="m12 3 7 7-7 11L5 10 12 3Z"/><path d="M8.5 10h7M12 7v6"/></>}{metricName === "evidence" && <><path d="M6 3h9l3 3v15H6z"/><path d="M9 12h6M9 16h4M15 3v4h3"/></>}</svg></span>;
}

export function GameLabel({ kind, value, size = "sm" }: { kind: Exclude<VisualKind, "metric">; value?: string | null; size?: "sm" | "md" }) {
  const label = value?.trim() || (kind === "agent" ? "Unknown agent" : kind === "map" ? "Unknown map" : "Unknown role");
  return <span className="game-label"><GameVisual kind={kind} value={label} size={size} /><span>{label}</span></span>;
}
