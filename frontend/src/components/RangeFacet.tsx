import { type PointerEvent, useMemo, useRef } from "react";
import { usePointerDrag } from "../hooks/usePointerDrag";
import { boundText, percentText, roundedBound, shareInRange } from "../lib/columnFacets";
import { clamp } from "../lib/numbers";
import type { ColumnCondition, ColumnDefinition } from "../lib/resultTable";
import { ScoreHistogram, type ValueRange } from "../lib/scoreHistogram";
import { HistogramBars } from "./HistogramBars";
import { NumberField } from "./NumberField";

interface RangeFacetProps {
  column: ColumnDefinition;
  numbers: number[];
  domain: ValueRange;
  condition: ColumnCondition | undefined;
  onChange: (condition: ColumnCondition | undefined) => void;
}

const HIGHLIGHT_COLOR = "var(--accent)";
const AXIS_TICK_COUNT = 5;

/**
 * Histogram of a numeric column with two handles that bound the listed range, applied while they are dragged.
 */
export function RangeFacet({ column, numbers, domain, condition, onChange }: RangeFacetProps) {
  const isMovingLower = useRef(true);
  const lower = condition?.kind === "range" ? (condition.minimum ?? domain.lower) : domain.lower;
  const upper = condition?.kind === "range" ? (condition.maximum ?? domain.upper) : domain.upper;
  const histogram = useMemo(() => ScoreHistogram.of(numbers, domain), [numbers, domain]);
  const span = domain.upper - domain.lower;
  const fractionOf = (value: number) => clamp((value - domain.lower) / span, 0, 1);

  const change = (nextLower: number, nextUpper: number) => {
    const minimum = nextLower <= domain.lower ? null : nextLower;
    const maximum = nextUpper >= domain.upper ? null : nextUpper;
    onChange(minimum === null && maximum === null ? undefined : { kind: "range", minimum, maximum });
  };

  const valueAt = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    return roundedBound(domain.lower + fraction * span, column.key);
  };

  const drag = usePointerDrag<HTMLDivElement>({
    canStart: (event) => {
      const value = valueAt(event);
      isMovingLower.current = lower === upper ? value <= lower : Math.abs(value - lower) <= Math.abs(value - upper);
      return true;
    },
    onDrag: (event) => {
      const value = valueAt(event);
      if (isMovingLower.current) change(Math.min(value, upper), upper);
      else change(lower, Math.max(value, lower));
    },
  });

  const step = column.key === "frame" ? 1 : column.key === "confidence" ? 0.01 : 0.1;
  const ticks = Array.from({ length: AXIS_TICK_COUNT }, (_, index) =>
    roundedBound(domain.lower + (span * index) / (AXIS_TICK_COUNT - 1), column.key),
  );

  return (
    <>
      <div className="filter-panel-detail-head">
        <span className="filter-panel-detail-title">{column.label}</span>
        <span className="grow" />
        <button className="ghost small" disabled={condition === undefined} onClick={() => onChange(undefined)}>
          Reset
        </button>
      </div>
      <div
        className="filter-range-track"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
      >
        <HistogramBars
          histogram={histogram}
          color={HIGHLIGHT_COLOR}
          isHighlighted={(bin) => {
            const middle = histogram.middleScoreOf(bin);
            return middle >= lower && middle <= upper;
          }}
        />
        <span className="filter-range-handle" style={{ left: `${fractionOf(lower) * 100}%` }} />
        <span className="filter-range-handle" style={{ left: `${fractionOf(upper) * 100}%` }} />
      </div>
      <div className="filter-range-axis">
        {ticks.map((tick, index) => (
          <span key={index}>{boundText(tick, column.key)}</span>
        ))}
      </div>
      <div className="filter-range-fields">
        <NumberField
          value={lower}
          minimum={domain.lower}
          maximum={domain.upper}
          step={step}
          width={68}
          onCommit={(value) => change(Math.min(value, upper), upper)}
        />
        <span>–</span>
        <NumberField
          value={upper}
          minimum={domain.lower}
          maximum={domain.upper}
          step={step}
          width={68}
          onCommit={(value) => change(lower, Math.max(value, lower))}
        />
        <span className="grow" />
        <span>{percentText(shareInRange(numbers, lower, upper))} in range</span>
      </div>
    </>
  );
}
