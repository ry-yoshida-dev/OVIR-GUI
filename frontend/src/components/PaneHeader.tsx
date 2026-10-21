import type { ReactNode } from "react";

interface PaneHeaderProps {
  title: string;
  leading?: ReactNode;
  children?: ReactNode;
}

export function PaneHeader({ title, leading, children }: PaneHeaderProps) {
  return (
    <div className="pane-header">
      {leading}
      <h2 className="pane-title" title={title}>
        {title}
      </h2>
      <span className="grow" />
      {children}
    </div>
  );
}
