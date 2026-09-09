import { Link } from "react-router-dom";
import type { Recommendation, UserRecommendationStatus } from "../types/recommendation";
import { GameVisual } from "./GameVisual";

export function isAnalyticalStatus(status: string) {
  return ["effective", "ineffective", "inconclusive"].includes(status);
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Active", completed: "Completed", superseded: "Superseded",
    effective: "Effective", ineffective: "Ineffective", inconclusive: "Inconclusive",
    insufficient_data: "Awaiting evidence", directional: "Directional", supported: "Supported"
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

export function RecommendationCard({ recommendation, primary = false, readOnly, saving, onStatusChange }: {
  recommendation: Recommendation;
  primary?: boolean;
  readOnly: boolean;
  saving: boolean;
  onStatusChange: (id: number, status: UserRecommendationStatus) => void;
}) {
  const analytical = isAnalyticalStatus(recommendation.status);
  return (
    <article className={primary ? "surface-strong panel-padding" : "surface-subtle p-4"}>
      <div className="chip-row">
        <span className="chip chip-accent">{primary ? "Primary recommendation" : "Supporting recommendation"} #{recommendation.id}</span>
        <span className="chip">{analytical ? "Analytical outcome" : "Lifecycle"}: {statusLabel(recommendation.status)}</span>
      </div>
      <div className="game-context mt-4"><GameVisual kind="metric" value="↗" size="md" /><div className="game-context-copy"><h2 className={primary ? "section-title" : "text-lg font-semibold"}>{recommendation.title}</h2><small>{recommendation.target_issue_category ? `Target · ${recommendation.target_issue_category.replace(/_/g, " ")}` : "Evidence-led coaching action"}</small></div></div>
      <p className="mt-3 whitespace-pre-line text-lg leading-8 text-[var(--text-soft)]">{recommendation.action}</p>
      <div className="mt-5">
        <p className="label">Why this recommendation exists</p>
        <p className="section-copy">{recommendation.evidence_summary}</p>
      </div>
      <div className="chip-row mt-4">
        <span className="chip">Category: {recommendation.category.replace(/_/g, " ")}</span>
        {recommendation.target_issue_category && <span className="chip">Target issue: {recommendation.target_issue_category.replace(/_/g, " ")}</span>}
        {recommendation.target_metric && <span className="chip">Target metric: {recommendation.target_metric.replace(/_/g, " ")}</span>}
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Link className="button button-secondary" to={`/progress?recommendation_id=${recommendation.id}`}>Explore evidence</Link>
        {!analytical && (
          <label className="field-label">
            Lifecycle status
            <select className="select" aria-label={`Lifecycle status for recommendation ${recommendation.id}`} disabled={readOnly || saving}
              value={recommendation.status}
              onChange={(event) => onStatusChange(recommendation.id, event.target.value as UserRecommendationStatus)}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="superseded">Superseded</option>
            </select>
          </label>
        )}
      </div>
      <p className="microcopy mt-3">{analytical
        ? "Outcome is calculated by Strata from later evidence; it cannot be set manually."
        : "Lifecycle records your action. Completing a recommendation does not mark it effective."}</p>
    </article>
  );
}
