import type { RankedScore } from "../api/types";

interface ScoreSpectrumProps {
  scores: RankedScore[];
  colorOf: (className: string) => string;
}

export function ScoreSpectrum({ scores, colorOf }: ScoreSpectrumProps) {
  if (scores.length === 0) return null;
  return (
    <div className="score-spectrum" aria-hidden="true">
      {scores.map((score, rank) => (
        <span
          key={score.class_name}
          className={rank === 0 ? "score-spectrum-bar leader" : "score-spectrum-bar"}
          style={{
            height: `${Math.max(0, Math.min(1, score.score)) * 100}%`,
            background: colorOf(score.class_name),
          }}
        />
      ))}
    </div>
  );
}
