import type { ScoreChartLevel } from "./ScoreChartRow";

interface ScoreChartLabelProps {
  title: string;
  level: ScoreChartLevel;
  color: string;
  isExpandable: boolean;
  isExpanded: boolean;
  onToggleExpanded?: () => void;
}

export function ScoreChartLabel({
  title,
  level,
  color,
  isExpandable,
  isExpanded,
  onToggleExpanded,
}: ScoreChartLabelProps) {
  return (
    <div
      className={`score-chart-label${isExpandable ? " expandable" : ""}`}
      title={
        isExpandable
          ? `${title}: click to ${isExpanded ? "fold" : "unfold"} its prompts`
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
      {level !== "prompt" && (
        <span className="score-chart-dot" style={{ background: color }} />
      )}
      <span className="score-chart-name">
        {level === "prompt" ? `“${title}”` : title}
      </span>
    </div>
  );
}
