import type { ScoreHistogram } from "../lib/scoreHistogram";
import { HistogramBars } from "./HistogramBars";
import { ScoreChartLabel } from "./ScoreChartLabel";
import { CHART_HEIGHTS, type ScoreChartLevel } from "./ScoreChartRow";

interface DistributionChartRowProps {
  title: string;
  level: ScoreChartLevel;
  color: string;
  histogram: ScoreHistogram;
  hint: string;
  keptCount: number;
  isExpandable?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function DistributionChartRow({
  title,
  level,
  color,
  histogram,
  hint,
  keptCount,
  isExpandable = false,
  isExpanded = false,
  onToggleExpanded,
}: DistributionChartRowProps) {
  const height = CHART_HEIGHTS[level];
  return (
    <div className={`score-chart-row ${level}`}>
      <ScoreChartLabel
        title={title}
        level={level}
        color={color}
        isExpandable={isExpandable}
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
      />
      <div className="score-chart read-only" style={{ height: height + 16 }}>
        <div className="score-chart-tag-lane">
          <span className="score-chart-bound lower">
            {histogram.range.lower.toFixed(2)}
          </span>
          <span className="score-chart-bound upper">
            {histogram.range.upper.toFixed(2)}
          </span>
        </div>
        <div className="score-chart-area" style={{ height }} title={hint}>
          <HistogramBars
            histogram={histogram}
            color={color}
            isHighlighted={() => true}
          />
        </div>
      </div>
      <span
        className={`score-chart-count${keptCount === 0 ? " empty" : ""}`}
        title="Kept findings"
      >
        {keptCount}
      </span>
      <span />
    </div>
  );
}
