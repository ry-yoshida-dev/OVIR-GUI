import { useState } from "react";
import type { ReviewMode } from "../lib/reviewModes";
import type { ScoreHistogram } from "../lib/scoreHistogram";
import { ResetGlyph } from "./Glyphs";
import { ScoreHistogramChart } from "./ScoreHistogramChart";

export type ScoreChartLevel = "overall" | "class" | "phrase";

interface ScoreChartRowProps {
  title: string;
  level: ScoreChartLevel;
  mode: ReviewMode;
  color: string;
  histogram: ScoreHistogram;
  threshold: number;
  parentThreshold: number | null;
  isOwn: boolean;
  keptCount: number;
  isExpandable?: boolean;
  isExpanded?: boolean;
  isDisabled?: boolean;
  resetLabel: string;
  onChange: (value: number) => void;
  onReset: (() => void) | null;
  onToggleExpanded?: () => void;
}

const CHART_HEIGHTS: Record<ScoreChartLevel, number> = {
  overall: 44,
  class: 44,
  phrase: 30,
};

export function ScoreChartRow({
  title,
  level,
  mode,
  color,
  histogram,
  threshold,
  parentThreshold,
  isOwn,
  keptCount,
  isExpandable = false,
  isExpanded = false,
  isDisabled = false,
  resetLabel,
  onChange,
  onReset,
  onToggleExpanded,
}: ScoreChartRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <div className={`score-chart-row ${level}`}>
      <div
        className={`score-chart-label${isExpandable ? " expandable" : ""}`}
        title={
          isExpandable
            ? `${title}: click to ${isExpanded ? "fold" : "unfold"} its phrases`
            : title
        }
        onClick={isExpandable ? onToggleExpanded : undefined}
      >
        {level === "class" && (
          <span
            className={`chevron${isExpanded ? " expanded" : ""}${isExpandable ? "" : " hidden"}`}
          >
            ▸
          </span>
        )}
        {level !== "phrase" && (
          <span className="score-chart-dot" style={{ background: color }} />
        )}
        <span className="score-chart-name">
          {level === "phrase" ? `“${title}”` : title}
        </span>
      </div>
      <ScoreHistogramChart
        mode={mode}
        histogram={histogram}
        threshold={threshold}
        parentThreshold={parentThreshold}
        color={color}
        isOwn={isOwn}
        isEditing={isEditing}
        isDisabled={isDisabled}
        height={CHART_HEIGHTS[level]}
        onChange={onChange}
        onReset={onReset}
        onEditingChange={setIsEditing}
      />
      <span
        className={`score-chart-count${keptCount === 0 ? " empty" : ""}`}
        title="Kept findings"
      >
        {keptCount}
      </span>
      <button
        type="button"
        className={`section-action score-chart-reset${onReset === null ? " hidden" : ""}`}
        title={resetLabel}
        aria-label={`${resetLabel}: ${title}`}
        disabled={isDisabled || onReset === null}
        onClick={() => onReset?.()}
      >
        <ResetGlyph />
      </button>
    </div>
  );
}
