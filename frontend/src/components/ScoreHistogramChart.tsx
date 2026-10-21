import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReviewMode } from "../lib/reviewModes";
import { snappedValue } from "../lib/reviewModes";
import { ScoreHistogram } from "../lib/scoreHistogram";

interface ScoreHistogramChartProps {
  mode: ReviewMode;
  histogram: ScoreHistogram;
  threshold: number;
  parentThreshold: number | null;
  color: string;
  isOwn: boolean;
  isEditing: boolean;
  isDisabled: boolean;
  height: number;
  onChange: (value: number) => void;
  onReset: (() => void) | null;
  onEditingChange: (isEditing: boolean) => void;
}

const COARSE_STEP_FACTOR = 5;

function percentOf(value: number): string {
  return `${Math.min(1, Math.max(0, value)) * 100}%`;
}

export function ScoreHistogramChart({
  mode,
  histogram,
  threshold,
  parentThreshold,
  color,
  isOwn,
  isEditing,
  isDisabled,
  height,
  onChange,
  onReset,
  onEditingChange,
}: ScoreHistogramChartProps) {
  const area = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [text, setText] = useState(threshold.toFixed(2));

  useEffect(() => {
    if (isEditing) setText(threshold.toFixed(2));
  }, [isEditing, threshold]);

  const valueAt = (clientX: number): number => {
    const bounds = area.current?.getBoundingClientRect();
    if (bounds === undefined || bounds.width <= 0) return threshold;
    return snappedValue(mode, (clientX - bounds.left) / bounds.width);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isDisabled || event.button !== 0 || event.detail > 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    const value = valueAt(event.clientX);
    if (value !== threshold) onChange(value);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const value = valueAt(event.clientX);
    if (value !== threshold) onChange(value);
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isDisabled || isEditing) return;
    const step = mode.step * (event.shiftKey ? COARSE_STEP_FACTOR : 1);
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        onChange(snappedValue(mode, threshold - step));
        break;
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        onChange(snappedValue(mode, threshold + step));
        break;
      case "Enter":
        event.preventDefault();
        onEditingChange(true);
        break;
      case "Backspace":
      case "Delete":
        if (onReset !== null) {
          event.preventDefault();
          onReset();
        }
        break;
      default:
        break;
    }
  };

  const commitText = () => {
    const parsed = Number.parseFloat(text);
    if (!Number.isNaN(parsed)) onChange(snappedValue(mode, parsed));
    onEditingChange(false);
  };

  const largestCount = histogram.largestCount;
  const binCount = ScoreHistogram.BIN_COUNT;
  return (
    <div
      className={`score-chart${isDisabled ? " disabled" : ""}${isDragging ? " dragging" : ""}`}
      style={{ height: height + 16 }}
      tabIndex={isDisabled ? -1 : 0}
      role="slider"
      aria-valuemin={mode.minimum}
      aria-valuemax={mode.maximum}
      aria-valuenow={threshold}
      onKeyDown={handleKeyDown}
    >
      <div className="score-chart-tag-lane">
        {isEditing ? (
          <input
            className="score-chart-input"
            style={{
              left: `clamp(24px, ${percentOf(threshold)}, calc(100% - 24px))`,
            }}
            value={text}
            autoFocus
            onChange={(event) => setText(event.target.value)}
            onBlur={commitText}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitText();
              else if (event.key === "Escape") onEditingChange(false);
            }}
          />
        ) : (
          <button
            type="button"
            className={`score-chart-tag${isOwn ? " own" : ""}`}
            style={{
              left: `clamp(16px, ${percentOf(threshold)}, calc(100% - 16px))`,
              background: isOwn ? color : undefined,
            }}
            disabled={isDisabled}
            title="Click to type a value"
            onClick={() => onEditingChange(true)}
          >
            {threshold.toFixed(2)}
          </button>
        )}
      </div>
      <div
        ref={area}
        className="score-chart-area"
        style={{ height }}
        title={`${mode.valueHint}\nDrag to move it, or use the arrow keys (Shift for larger steps); double-click to reset.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={() => {
          if (!isDisabled && onReset !== null) onReset();
        }}
      >
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
              const isAtOrAbove = histogram.middleScoreOf(bin) >= threshold;
              const isHighlighted =
                mode.highlight === "at-or-above" ? isAtOrAbove : !isAtOrAbove;
              return (
                <rect
                  key={bin}
                  x={bin + 0.06}
                  y={1 - barHeight}
                  width={0.88}
                  height={barHeight}
                  className={isHighlighted ? undefined : "muted"}
                  style={isHighlighted ? { fill: color } : undefined}
                >
                  <title>{`${(bin / binCount).toFixed(2)}–${((bin + 1) / binCount).toFixed(2)}: ${count}`}</title>
                </rect>
              );
            })}
        </svg>
        {parentThreshold !== null && (
          <span
            className="score-chart-parent"
            style={{ left: percentOf(parentThreshold) }}
          />
        )}
        <span
          className="score-chart-line"
          style={{
            left: percentOf(threshold),
            background: isOwn ? color : undefined,
          }}
        />
      </div>
    </div>
  );
}
