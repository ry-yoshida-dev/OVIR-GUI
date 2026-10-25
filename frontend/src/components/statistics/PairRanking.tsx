import type { ReactNode } from "react";
import type { ClassPair } from "../../lib/classPairs";
import { type ClassColors, classColorOf, SWATCH_FALLBACK_COLOR } from "../../lib/frameView";
import { formatCount } from "../../lib/statisticsFormat";

interface PairRankingProps {
  pairs: ClassPair[];
  classColors: ClassColors;
  joiner: string;
  emptyText: string;
  detailOf?: (pair: ClassPair) => ReactNode;
  titleOf: (pair: ClassPair) => string;
}

/**
 * Class pairs ranked by their count, each with a bar scaled to the first.
 */
export function PairRanking({ pairs, classColors, joiner, emptyText, detailOf, titleOf }: PairRankingProps) {
  if (pairs.length === 0) return <div className="statistics-empty">{emptyText}</div>;
  const largest = Math.max(1, ...pairs.map((pair) => pair.count));
  const nameOf = (className: string) => (
    <span className="pair-ranking-class">
      <span className="swatch" style={{ background: classColorOf(classColors, className, SWATCH_FALLBACK_COLOR) }} />
      <span className="pair-ranking-name">{className}</span>
    </span>
  );
  return (
    <ol className="pair-ranking">
      {pairs.map((pair) => (
        <li key={`${pair.first}\u0000${pair.second}`} title={titleOf(pair)}>
          <div className="pair-ranking-names">
            {nameOf(pair.first)}
            <span className="pair-ranking-joiner">{joiner}</span>
            {nameOf(pair.second)}
          </div>
          <div className="value-bar">
            <span className="value-bar-number">{formatCount(pair.count)}</span>
            <span className="value-bar-track">
              <span className="value-bar-fill" style={{ width: `${(pair.count / largest) * 100}%` }} />
            </span>
          </div>
          {detailOf !== undefined && <div className="pair-ranking-detail">{detailOf(pair)}</div>}
        </li>
      ))}
    </ol>
  );
}
