import { useRef, useState } from "react";
import type { AggregationMethodValue, AggregationStep } from "../api/types";
import {
  type AggregationRows,
  DEFAULT_ROW_ORDER,
  type RowUnit,
  TIMING_MARKS,
  UNIT_TITLES,
  isSameSteps,
  rowsOf,
  stepsOf,
} from "../lib/aggregationRows";
import { AggregationPanel } from "./AggregationPanel";

interface AggregationFieldProps {
  steps: AggregationStep[];
  methods: { value: AggregationMethodValue; title: string }[];
  isDisabled: boolean;
  onChange: (steps: AggregationStep[]) => void;
}

/**
 * Picker summing up the aggregation steps in the order they run, opening the panel beside the setup pane to choose
 * them. The order of the rows is kept while the page is open, also where it does not change the steps.
 */
export function AggregationField({ steps, methods, isDisabled, onChange }: AggregationFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [order, setOrder] = useState<[RowUnit, RowUnit]>(DEFAULT_ROW_ORDER);
  const field = useRef<HTMLDivElement>(null);
  const aggregation: AggregationRows = rowsOf(steps, order);
  const titleOf = (value: AggregationMethodValue) =>
    methods.find((method) => method.value === value)?.title ?? value;
  const units = steps.map((step) => UNIT_TITLES[step.unit]).join(" → ");
  const summary = steps.map((step) => `${TIMING_MARKS[step.timing]} ${titleOf(step.method)}`).join(" → ");

  const change = (next: AggregationRows) => {
    setOrder([next.rows[0].unit, next.rows[1].unit]);
    const nextSteps = stepsOf(next);
    if (!isSameSteps(nextSteps, steps)) onChange(nextSteps);
  };

  return (
    <div ref={field} className="aggregation-field">
      <button
        className={`model-picker${isOpen ? " open" : ""}`}
        disabled={isDisabled}
        title="Choose how the prompts and templates of a class become its score"
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <span className="model-picker-name">
          <span className="small muted">{steps.length === 0 ? "Every sentence" : units}</span>
          <span>{steps.length === 0 ? "No aggregation" : summary}</span>
        </span>
        <span className="model-picker-chevron" aria-hidden>
          ›
        </span>
      </button>
      {isOpen && (
        <AggregationPanel
          anchor={field}
          aggregation={aggregation}
          methods={methods}
          isDisabled={isDisabled}
          onChange={change}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
