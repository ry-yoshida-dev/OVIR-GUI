import type { ConfidenceSummaryPayload } from "../../api/types";
import { formatScore } from "../../lib/statisticsFormat";

interface ConfidenceStripProps {
  summary: ConfidenceSummaryPayload | null;
  minimum: number;
  color: string;
}

const HEIGHT = 18;
const BOX_TOP = 4;
const BOX_HEIGHT = 10;
const MIDDLE = BOX_TOP + BOX_HEIGHT / 2;

function xOf(value: number): number {
  return value * 100;
}

/**
 * Spread of the confidences of one class on a 0 to 1 axis: the whiskers reach the 10th and 90th percentiles, the box
 * spans the quartiles, the bar marks the median, and the band left of the minimum is what the review drops.
 */
export function ConfidenceStrip({ summary, minimum, color }: ConfidenceStripProps) {
  const description =
    summary === null
      ? "No findings"
      : [
          `Median ${formatScore(summary.median)} · mean ${formatScore(summary.mean)}`,
          `Middle half ${formatScore(summary.lower_quartile)}–${formatScore(summary.upper_quartile)}`,
          `10th–90th percentile ${formatScore(summary.lower_decile)}–${formatScore(summary.upper_decile)}`,
          `Range ${formatScore(summary.minimum)}–${formatScore(summary.maximum)}`,
          `Minimum confidence ${formatScore(minimum)}`,
        ].join("\n");
  return (
    <div className="confidence-strip" title={description}>
      <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" aria-label={description} role="img">
        <rect className="confidence-strip-dropped" x={0} y={0} width={xOf(minimum)} height={HEIGHT} />
        <line
          className="confidence-strip-axis"
          x1={0}
          x2={100}
          y1={MIDDLE}
          y2={MIDDLE}
          vectorEffect="non-scaling-stroke"
        />
        {summary !== null && (
          <>
            <line
              x1={xOf(summary.lower_decile)}
              x2={xOf(summary.upper_decile)}
              y1={MIDDLE}
              y2={MIDDLE}
              stroke={color}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={xOf(summary.lower_quartile)}
              y={BOX_TOP}
              width={Math.max(0.6, xOf(summary.upper_quartile - summary.lower_quartile))}
              height={BOX_HEIGHT}
              rx={1}
              fill={color}
              opacity={0.42}
            />
            <line
              x1={xOf(summary.median)}
              x2={xOf(summary.median)}
              y1={BOX_TOP - 1}
              y2={BOX_TOP + BOX_HEIGHT + 1}
              stroke={color}
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        <line
          className="confidence-strip-minimum"
          x1={xOf(minimum)}
          x2={xOf(minimum)}
          y1={0}
          y2={HEIGHT}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
