import type { ReactNode } from "react";
import { ChevronGlyph } from "./ChevronGlyph";

interface SectionProps {
  title: string;
  icon: ReactNode;
  count?: number;
  isCollapsed: boolean;
  onToggle: () => void;
  isStretched?: boolean;
  isFlush?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({ title, icon, count, isCollapsed, onToggle, isStretched = false, isFlush = false, actions, children }: SectionProps) {
  return (
    <section className={`section${isStretched && !isCollapsed ? " stretched" : ""}${isCollapsed ? " collapsed" : ""}`}>
      <div
        className="section-header is-toggle"
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          onToggle();
        }}
      >
        <span className="section-icon">{icon}</span>
        <span className="section-title">{title}</span>
        {count !== undefined && <span className="section-count">{count}</span>}
        <span className="grow" />
        {actions !== undefined && (
          <span className="section-actions" onClick={(event) => event.stopPropagation()}>
            {actions}
          </span>
        )}
        <span className="section-chevron">
          <ChevronGlyph />
        </span>
      </div>
      {!isCollapsed && <div className={`section-body${isFlush ? " flush" : ""}`}>{children}</div>}
    </section>
  );
}
