import { useState } from "react";
import type { FramePayload } from "../api/types";
import type { DisplayOptions } from "../lib/displayOptions";
import { comparedOf, FALLBACK_CLASS_COLOR } from "../lib/frameView";

interface ScorePanelProps {
  frame: FramePayload;
  listedIndices: Set<number> | null;
  options: DisplayOptions;
  classColors: Record<string, string>;
  onSelectFinding: (index: number) => void;
}

const SCORE_LINES = 5;

export function ScorePanel({ frame, listedIndices, options, classColors, onSelectFinding }: ScorePanelProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const scores = frame.scores;
  if (scores.length === 0 || !options.isScorePanelShown) return null;
  const hiddenCount = scores.length - SCORE_LINES;
  const top = frame.findings[0];
  const isTopKept = top !== undefined && top.is_accepted && top.is_above_minimum && (listedIndices?.has(0) ?? true);
  const compared = comparedOf(frame, options);
  const colorOf = (className: string) => classColors[className] ?? FALLBACK_CLASS_COLOR;
  return (
    <div className="score-panel">
      {(isExpanded ? scores : scores.slice(0, SCORE_LINES)).map((score, position) => (
        <div
          key={score.class_name}
          className={`score-line${position === 0 && isTopKept ? " top" : ""}${position === 0 && top !== undefined && !top.is_accepted ? " rejected" : ""}`}
          title={`${score.class_name}: score ${score.score.toFixed(4)}, logit ${score.logit.toFixed(3)}, query "${score.query}"`}
          onClick={() => position === 0 && onSelectFinding(0)}
        >
          <span className="swatch" style={{ background: colorOf(score.class_name) }} />
          <span className="name">{score.class_name}</span>
          <span className="bar">
            <span style={{ width: `${Math.max(0, Math.min(1, score.score)) * 100}%`, background: colorOf(score.class_name) }} />
          </span>
          <span className="value">{score.score.toFixed(3)}</span>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button type="button" className="score-more" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? "Show less" : `+${hiddenCount} more`}
        </button>
      )}
      {compared !== null && compared.top_class !== null && (
        <div className="score-line compared" title={compared.model_name}>
          <span className="swatch" style={{ background: colorOf(compared.top_class) }} />
          <span className="name">
            {compared.model_name}: {compared.top_class}
          </span>
        </div>
      )}
    </div>
  );
}
