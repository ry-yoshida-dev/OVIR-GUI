import { useState } from "react";
import type { FramePayload } from "../api/types";
import type { DisplayOptions } from "../lib/displayOptions";
import { type ClassColors, classColorOf, comparedOf } from "../lib/frameView";
import { clamp } from "../lib/numbers";

interface ScorePanelProps {
  frame: FramePayload;
  listedIndices: Set<number> | null;
  options: DisplayOptions;
  classColors: ClassColors;
  onSelectFinding: (index: number) => void;
}

const SCORE_LINES = 5;

export function ScorePanel({ frame, listedIndices, options, classColors, onSelectFinding }: ScorePanelProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const scores = frame.scores;
  if (scores.length === 0 || !options.isScorePanelShown) return null;
  const hiddenCount = scores.length - SCORE_LINES;
  const findingOf = new Map(frame.findings.map((finding) => [finding.class_name, finding] as const));
  const isKept = (className: string): boolean => {
    const finding = findingOf.get(className);
    return (
      finding !== undefined &&
      finding.is_accepted &&
      finding.is_passing &&
      (listedIndices?.has(finding.index) ?? true)
    );
  };
  const isRejected = (className: string): boolean => findingOf.get(className)?.is_accepted === false;
  const compared = comparedOf(frame, options);
  const colorOf = (className: string) => classColorOf(classColors, className);
  return (
    <div className="score-panel">
      {(isExpanded ? scores : scores.slice(0, SCORE_LINES)).map((score) => (
        <div
          key={score.class_name}
          className={`score-line${isKept(score.class_name) ? " top" : ""}${isRejected(score.class_name) ? " rejected" : ""}`}
          title={`${score.class_name}: score ${score.score.toFixed(4)}, logit ${score.logit.toFixed(3)}${score.similarity === null ? "" : `, similarity ${score.similarity.toFixed(4)}`}, query "${score.query}"`}
          onClick={() => {
            const finding = findingOf.get(score.class_name);
            if (finding !== undefined) onSelectFinding(finding.index);
          }}
        >
          <span className="swatch" style={{ background: colorOf(score.class_name) }} />
          <span className="name">{score.class_name}</span>
          <span className="bar">
            <span style={{ width: `${clamp(score.score, 0, 1) * 100}%`, background: colorOf(score.class_name) }} />
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
