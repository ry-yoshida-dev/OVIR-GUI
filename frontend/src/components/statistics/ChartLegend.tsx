export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  isLine?: boolean;
}

interface ChartLegendProps {
  entries: LegendEntry[];
}

/**
 * Row of swatches naming the series of a chart.
 */
export function ChartLegend({ entries }: ChartLegendProps) {
  return (
    <div className="chart-key">
      {entries.map((entry) => (
        <span key={entry.key} className="chart-key-entry">
          <span
            className={entry.isLine === true ? "chart-key-line" : "chart-key-swatch"}
            style={{ background: entry.color }}
          />
          {entry.label}
        </span>
      ))}
    </div>
  );
}
