import type { ReactNode } from "react";

interface StatisticsCardProps {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Titled card of the statistics with an optional description below the title and a legend or control beside it.
 */
export function StatisticsCard({ title, description, aside, className, children }: StatisticsCardProps) {
  return (
    <section className={`statistics-card${className === undefined ? "" : ` ${className}`}`}>
      <header className="statistics-card-header">
        <div className="statistics-card-heading">
          <h3>{title}</h3>
          {description !== undefined && <p>{description}</p>}
        </div>
        {aside !== undefined && <div className="statistics-card-aside">{aside}</div>}
      </header>
      <div className="statistics-card-body">{children}</div>
    </section>
  );
}
