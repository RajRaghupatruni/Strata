import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  rightSlot?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, rightSlot }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </header>
  );
}
