import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  rightSlot?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, rightSlot }: PageHeaderProps) {
  return (
    <header className="strata-glass strata-hero flex flex-wrap items-start justify-between gap-4 p-4 md:p-5">
      <div className="relative z-[1] space-y-1">
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.22em] text-stone-400">{eyebrow}</p>
        )}
        <h2 className="text-2xl font-semibold tracking-tight md:text-[1.9rem]">
          <span className="strata-gradient-text">{title}</span>
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-stone-300/95">{description}</p>
      </div>
      {rightSlot && <div className="relative z-[1] shrink-0">{rightSlot}</div>}
    </header>
  );
}
