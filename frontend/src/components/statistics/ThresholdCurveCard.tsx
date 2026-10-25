import { type KeyboardEvent, useRef, useState } from "react";
import type { ClassStatisticsPayload } from "../../api/types";
import { usePointerDrag } from "../../hooks/usePointerDrag";
import { clamp } from "../../lib/numbers";
import { formatCount, formatScore } from "../../lib/statisticsFormat";

interface ThresholdCurveCardProps {
  entry: ClassStatisticsPayload;
  stepCount: number;
  color: string;
  minimum: number;
  isOwnMinimum: boolean;
  isFocused: boolean;
  isClassification: boolean;
  onMinimumChange: (minimum: number) => void;
  onReset: () => void;
}

const WIDTH = 300;
const HEIGHT = 112;
const PAD_TOP = 6;
const FINE_STEP = 0.01;
const COARSE_STEP = 0.05;
const TOOLTIP_FLIP_RATIO = 0.6;

function roundedMinimum(value: number): number {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
}

/**
 * How many findings and pictures of one class every minimum confidence would keep, with the current minimum as a
 * line to drag; arrow keys move it, and a double-click or Delete takes the class back to the default minimum.
 */
export function ThresholdCurveCard({
  entry,
  stepCount,
  color,
  minimum,
  isOwnMinimum,
  isFocused,
  isClassification,
  onMinimumChange,
  onReset,
}: ThresholdCurveCardProps) {
  const plot = useRef<HTMLDivElement>(null);
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  const findingCounts = entry.threshold_curve.finding_counts;
  const pictureCounts = entry.threshold_curve.picture_counts;
  const largest = Math.max(1, findingCounts[0] ?? 0);
  const xOf = (step: number) => (step / stepCount) * WIDTH;
  const yOf = (count: number) => PAD_TOP + (1 - count / largest) * (HEIGHT - PAD_TOP);
  const pathOf = (counts: number[]) =>
    counts
      .map((count, step) => `${step === 0 ? "M" : "L"}${xOf(step).toFixed(1)} ${yOf(count).toFixed(1)}`)
      .join(" ");
  const findingPath = pathOf(findingCounts);
  const minimumStep = Math.round(minimum * stepCount);
  const keptFindings = findingCounts[minimumStep] ?? 0;
  const keptPictures = pictureCounts[minimumStep] ?? 0;

  const stepAt = (clientX: number): number => {
    const bounds = plot.current?.getBoundingClientRect();
    if (bounds === undefined || bounds.width <= 0) return minimumStep;
    return Math.round(clamp((clientX - bounds.left) / bounds.width, 0, 1) * stepCount);
  };
  const drag = usePointerDrag<HTMLDivElement>({
    canStart: (event) => event.button === 0 && event.detail <= 1,
    onDrag: (event) => {
      const value = roundedMinimum(stepAt(event.clientX) / stepCount);
      if (value !== minimum) onMinimumChange(value);
    },
  });
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? COARSE_STEP : FINE_STEP;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        onMinimumChange(roundedMinimum(minimum - step));
        break;
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        onMinimumChange(roundedMinimum(minimum + step));
        break;
      case "Backspace":
      case "Delete":
        if (isOwnMinimum) {
          event.preventDefault();
          onReset();
        }
        break;
      default:
        break;
    }
  };
  const hoverRatio = hoverStep === null ? 0 : hoverStep / stepCount;

  return (
    <div className={`threshold-card${isFocused ? " focused" : ""}`} id={`threshold-${entry.class_name}`}>
      <div className="threshold-card-header">
        <span className="swatch" style={{ background: color }} />
        <span className="threshold-card-name">{entry.class_name}</span>
        <span className={`threshold-card-minimum${isOwnMinimum ? " own" : ""}`}>
          {isOwnMinimum ? "Own" : "Default"} {formatScore(minimum)}
        </span>
        {isOwnMinimum && (
          <button className="ghost icon threshold-card-reset" title="Use the default minimum" onClick={onReset}>
            ↺
          </button>
        )}
      </div>
      <div className="threshold-card-readout">
        {isClassification ? (
          <>
            <strong>{formatCount(keptFindings)}</strong> {keptFindings === 1 ? "picture" : "pictures"} labelled
          </>
        ) : (
          <>
            <strong>{formatCount(keptFindings)}</strong> {keptFindings === 1 ? "finding" : "findings"} on{" "}
            <strong>{formatCount(keptPictures)}</strong> {keptPictures === 1 ? "picture" : "pictures"}
          </>
        )}
        <span className="faint"> of {formatCount(findingCounts[0] ?? 0)}</span>
      </div>
      <div
        ref={plot}
        className={`threshold-plot${drag.isDragging ? " dragging" : ""}`}
        tabIndex={0}
        role="slider"
        aria-label={`Minimum confidence of ${entry.class_name}`}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={minimum}
        onKeyDown={handleKeyDown}
        onPointerDown={drag.onPointerDown}
        onPointerMove={(event) => {
          setHoverStep(stepAt(event.clientX));
          drag.onPointerMove(event);
        }}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
        onPointerLeave={() => setHoverStep(null)}
        onDoubleClick={() => {
          if (isOwnMinimum) onReset();
        }}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
          <rect className="threshold-plot-dropped" x={0} y={0} width={xOf(minimumStep)} height={HEIGHT} />
          {[0.5, 1].map((fraction) => (
            <line
              key={fraction}
              className="threshold-plot-grid"
              x1={0}
              x2={WIDTH}
              y1={yOf(largest * fraction)}
              y2={yOf(largest * fraction)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={`${findingPath} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`} fill={color} opacity={0.1} />
          {!isClassification && (
            <path
              d={pathOf(pictureCounts)}
              className="threshold-plot-pictures"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={findingPath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {hoverStep !== null && (
            <line
              className="threshold-plot-hover"
              x1={xOf(hoverStep)}
              x2={xOf(hoverStep)}
              y1={0}
              y2={HEIGHT}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <line
            className="threshold-plot-minimum"
            x1={xOf(minimumStep)}
            x2={xOf(minimumStep)}
            y1={0}
            y2={HEIGHT}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="threshold-plot-handle" style={{ left: `${minimum * 100}%`, borderColor: color }} />
        {hoverStep !== null && !drag.isDragging && (
          <div
            className={`chart-tooltip threshold-tooltip${hoverRatio > TOOLTIP_FLIP_RATIO ? " flipped" : ""}`}
            style={{ left: `${hoverRatio * 100}%` }}
          >
            <div className="chart-tooltip-time mono">≥ {formatScore(hoverStep / stepCount)}</div>
            <div className="chart-tooltip-row">
              <span className="chart-key-line" style={{ background: color }} />
              <span className="name">{isClassification ? "Labels" : "Findings"}</span>
              <span className="mono">{formatCount(findingCounts[hoverStep] ?? 0)}</span>
            </div>
            {!isClassification && (
              <div className="chart-tooltip-row">
                <span className="chart-key-line" style={{ background: "var(--curve-pictures)" }} />
                <span className="name">Pictures</span>
                <span className="mono">{formatCount(pictureCounts[hoverStep] ?? 0)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="threshold-axis">
        <span>0</span>
        <span>0.25</span>
        <span>0.5</span>
        <span>0.75</span>
        <span>1</span>
      </div>
    </div>
  );
}
