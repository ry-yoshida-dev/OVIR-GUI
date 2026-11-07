import type { ReactNode } from "react";

interface ResultsHeadingProps {
  title: string;
  icon?: ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

export function ResultsHeading({ title, icon, isCollapsed, onToggle, children }: ResultsHeadingProps) {
  return (
    <div
      className={`results-heading${isCollapsed ? " collapsed" : ""}`}
      onClick={onToggle}
      title={isCollapsed ? `Show the ${title.toLowerCase()} results` : `Hide the ${title.toLowerCase()} results`}
    >
      <span className="chevron">▾</span>
      {icon}
      <span className="results-heading-title">{title}</span>
      <span className="results-heading-controls" onClick={(event) => event.stopPropagation()}>
        {children}
      </span>
    </div>
  );
}
