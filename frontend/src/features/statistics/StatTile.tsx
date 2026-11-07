import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: string;
  detail?: ReactNode;
  hint?: string;
  children?: ReactNode;
}

/**
 * One headline figure with its label, a line of context and an optional small graphic below.
 */
export function StatTile({ label, value, detail, hint, children }: StatTileProps) {
  return (
    <div className="stat-tile" title={hint}>
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      {detail !== undefined && <div className="stat-tile-detail">{detail}</div>}
      {children}
    </div>
  );
}
