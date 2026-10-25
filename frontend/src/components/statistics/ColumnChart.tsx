import { formatCount } from "../../lib/statisticsFormat";

export interface ChartColumn {
  key: string;
  label: string;
  value: number;
  title: string;
  isMuted?: boolean;
}

interface ColumnChartProps {
  columns: ChartColumn[];
  color: string;
  height?: number;
  isValueShown?: boolean;
  axisLabel?: string;
}

const TICK_TARGET_COUNT = 3;
const NICE_STEPS = [1, 2, 5, 10];

function ticksOf(largest: number): number[] {
  const rough = Math.max(1, largest) / TICK_TARGET_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = (NICE_STEPS.find((candidate) => candidate * magnitude >= rough) ?? 10) * magnitude;
  const top = Math.max(step, Math.ceil(Math.max(1, largest) / step) * step);
  const ticks: number[] = [];
  for (let tick = 0; tick <= top + step / 2; tick += step) ticks.push(tick);
  return ticks;
}

/**
 * Counts as columns rising from one baseline, with hairline gridlines at round values, the value on each cap when
 * there is room, and the exact count of every column when hovered.
 */
export function ColumnChart({ columns, color, height = 120, isValueShown = false, axisLabel }: ColumnChartProps) {
  const ticks = ticksOf(Math.max(0, ...columns.map((column) => column.value)));
  const top = ticks[ticks.length - 1] ?? 1;
  return (
    <div className="column-chart">
      <div className="column-chart-body" style={{ height }}>
        <div className="column-chart-axis">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>
              {formatCount(tick)}
            </span>
          ))}
        </div>
        <div className="column-chart-plot">
          {ticks.map((tick) => (
            <div
              key={tick}
              className={`column-chart-grid${tick === 0 ? " baseline" : ""}`}
              style={{ bottom: `${(tick / top) * 100}%` }}
            />
          ))}
          {columns.map((column) => (
            <div key={column.key} className="column-chart-slot" title={column.title}>
              {isValueShown && column.value > 0 && (
                <span className="column-chart-value" style={{ bottom: `${(column.value / top) * 100}%` }}>
                  {formatCount(column.value)}
                </span>
              )}
              <div
                className={`column-chart-bar${column.isMuted === true ? " muted" : ""}`}
                style={{ height: `${(column.value / top) * 100}%`, background: color }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="column-chart-labels">
        {columns.map((column) => (
          <span key={column.key}>{column.label}</span>
        ))}
      </div>
      {axisLabel !== undefined && <div className="column-chart-axis-label">{axisLabel}</div>}
    </div>
  );
}
