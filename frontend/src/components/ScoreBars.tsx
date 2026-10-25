import type { RankedScore } from "../api/types";
import { scoreBarHeightOf, scoreBarTitleOf } from "../lib/scoreBars";

interface ScoreBarsProps {
  scores: RankedScore[];
  colorOf: (className: string) => string;
}

/**
 * One vertical bar per class from best to worst, colored when the class reaches its minimum and gray otherwise.
 */
export function ScoreBars({ scores, colorOf }: ScoreBarsProps) {
  return (
    <span className="score-bars">
      {scores.map((score) => (
        <span
          key={score.class_name}
          className={score.is_reaching_minimum ? "score-bar" : "score-bar below"}
          style={{ color: colorOf(score.class_name) }}
          title={scoreBarTitleOf(score)}
        >
          <span className="score-bar-fill" style={{ height: `${scoreBarHeightOf(score) * 100}%` }} />
        </span>
      ))}
    </span>
  );
}
