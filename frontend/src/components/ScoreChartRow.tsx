import { useState } from "react";
import type { ReviewMode } from "../lib/reviewModes";
import type { ScoreHistogram } from "../lib/scoreHistogram";
import { ResetGlyph } from "./Glyphs";
import { ScoreChartLabel } from "./ScoreChartLabel";
import { ScoreHistogramChart } from "./ScoreHistogramChart";

export type ScoreChartLevel = "overall" | "class" | "prompt";

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

export const CHART_HEIGHTS: Record<ScoreChartLevel, number> = {
  overall: 44,
  class: 44,
  prompt: 30,
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
      <ScoreChartLabel
        title={title}
        level={level}
        color={color}
        isExpandable={isExpandable}
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
      />
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
