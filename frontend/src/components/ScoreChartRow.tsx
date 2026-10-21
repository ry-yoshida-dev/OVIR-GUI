import { type MouseEvent, useState } from "react";
import type { ReviewMode } from "../lib/reviewModes";
import type { ScoreHistogram } from "../lib/scoreHistogram";
import { useMenu } from "./Menu";
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
  isExpandable: boolean;
  isExpanded: boolean;
  isDisabled: boolean;
  resetLabel: string;
  onChange: (value: number) => void;
  onReset: (() => void) | null;
  onToggleExpanded: () => void;
}

const CHART_HEIGHTS: Record<ScoreChartLevel, number> = {
  overall: 26,
  class: 26,
  phrase: 18,
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
  isExpandable,
  isExpanded,
  isDisabled,
  resetLabel,
  onChange,
  onReset,
  onToggleExpanded,
}: ScoreChartRowProps) {
  const menu = useMenu();
  const [isEditing, setIsEditing] = useState(false);
  const openMenu = (event: MouseEvent) => {
    event.preventDefault();
    if (isDisabled) return;
    menu.open(event.clientX, event.clientY, [
      { label: "Enter Value…", onSelect: () => setIsEditing(true) },
      {
        label: resetLabel,
        isDisabled: onReset === null,
        onSelect: () => onReset?.(),
      },
    ]);
  };
  return (
    <div className={`score-chart-row ${level}`} onContextMenu={openMenu}>
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
      {menu.element}
    </div>
  );
}
