import { ScoreHistogram } from "../lib/scoreHistogram";

interface HistogramBarsProps {
  histogram: ScoreHistogram;
  color: string;
  isHighlighted: (bin: number) => boolean;
}

export function HistogramBars({
  histogram,
  color,
  isHighlighted,
}: HistogramBarsProps) {
  const largestCount = histogram.largestCount;
  const binCount = ScoreHistogram.BIN_COUNT;
  return (
    <svg
      className="score-chart-bars"
      viewBox={`0 0 ${binCount} 1`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {largestCount > 0 &&
        histogram.counts.map((count, bin) => {
          if (count === 0) return null;
          const barHeight = Math.max(0.06, Math.sqrt(count / largestCount));
          const isShownInColor = isHighlighted(bin);
          return (
            <rect
              key={bin}
              x={bin + 0.06}
              y={1 - barHeight}
              width={0.88}
              height={barHeight}
              className={isShownInColor ? undefined : "muted"}
              style={isShownInColor ? { fill: color } : undefined}
            >
              <title>{`${histogram.boundOf(bin).toFixed(2)}–${histogram.boundOf(bin + 1).toFixed(2)}: ${count}`}</title>
            </rect>
          );
        })}
    </svg>
  );
}
