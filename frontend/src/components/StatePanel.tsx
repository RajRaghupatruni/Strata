type StatePanelProps = {
  title: string;
  description: string;
  variant?: "loading" | "error" | "empty" | "success";
};

const toneClasses: Record<NonNullable<StatePanelProps["variant"]>, string> = {
  loading: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  error: "border-rose-300/35 bg-rose-500/12 text-rose-100",
  empty: "border-slate-400/25 bg-slate-900/45 text-slate-200",
  success: "border-emerald-300/35 bg-emerald-500/12 text-emerald-100"
};

const variantSymbol: Record<NonNullable<StatePanelProps["variant"]>, string> = {
  loading: "SYNC",
  error: "ALERT",
  empty: "INFO",
  success: "READY"
};

export function StatePanel({ title, description, variant = "empty" }: StatePanelProps) {
  return (
    <div className={`rounded-xl border p-4 ${toneClasses[variant]}`}>
      <p className="text-[0.65rem] uppercase tracking-[0.2em] opacity-80">
        {variantSymbol[variant]}
      </p>
      <p className="mt-1 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{description}</p>
    </div>
  );
}
