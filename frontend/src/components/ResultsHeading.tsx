import type { ReactNode } from "react";

interface ResultsHeadingProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

export function ResultsHeading({ title, isCollapsed, onToggle, children }: ResultsHeadingProps) {
  return (
    <div
      className={`results-heading${isCollapsed ? " collapsed" : ""}`}
      onClick={onToggle}
      title={isCollapsed ? `Show the ${title.toLowerCase()} results` : `Hide the ${title.toLowerCase()} results`}
    >
      <span className="chevron">▾</span>
      <span className="results-heading-title">{title}</span>
      <span className="results-heading-controls" onClick={(event) => event.stopPropagation()}>
        {children}
      </span>
    </div>
  );
}
