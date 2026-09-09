import { PUBLIC_DEMO_MESSAGE } from "../services/api/demoMode";

type StatePanelProps = {
  title: string;
  description: string;
  variant?: "loading" | "error" | "empty" | "success";
};

const labels: Record<NonNullable<StatePanelProps["variant"]>, string> = {
  loading: "Working",
  error: "Needs attention",
  empty: "No signal yet",
  success: "Complete"
};

const classes: Record<NonNullable<StatePanelProps["variant"]>, string> = {
  loading: "state-panel-loading",
  error: "state-panel-error",
  empty: "",
  success: "state-panel-success"
};

export function StatePanel({ title, description, variant = "empty" }: StatePanelProps) {
  if (description === PUBLIC_DEMO_MESSAGE) {
    return (
      <div className="state-panel" role="status">
        <p className="state-kicker">Explore the demo</p>
        <p className="state-title">This public demo is read-only</p>
        <p className="state-description">{description}</p>
      </div>
    );
  }
  return (
    <div className={`state-panel ${classes[variant]}`} role={variant === "error" ? "alert" : "status"}>
      {variant === "loading" && (
        <div className="mb-4 grid gap-2" aria-hidden="true">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-8 w-2/3 max-w-md" />
          <div className="skeleton h-3 w-full max-w-xl" />
        </div>
      )}
      <p className="state-kicker">{labels[variant]}</p>
      <p className="state-title">{title}</p>
      <p className="state-description">{description}</p>
    </div>
  );
}
