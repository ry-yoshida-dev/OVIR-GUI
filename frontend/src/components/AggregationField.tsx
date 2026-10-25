import { useRef, useState } from "react";
import type { AggregationMethodValue, AggregationStep, ScoreActivationValue } from "../api/types";
import {
  type AggregationRows,
  DEFAULT_ROW_ORDER,
  type RowUnit,
  TIMING_MARKS,
  UNIT_TITLES,
  isSameSteps,
  rowsOf,
  stepIndexOf,
  stepsOf,
} from "../lib/aggregationRows";
import { AggregationPanel } from "./AggregationPanel";

interface AggregationFieldProps {
  steps: AggregationStep[];
  defaultSteps: AggregationStep[];
  methods: { value: AggregationMethodValue; title: string }[];
  activation: ScoreActivationValue;
  isDisabled: boolean;
  onChange: (steps: AggregationStep[]) => void;
}

interface SummaryLine {
  unit: string;
  choice: string;
  isChosen: boolean;
}

/**
 * Picker summing up the aggregation of each unit on its own line, in the order the steps run, opening the panel beside
 * the setup pane to choose them. The order of the rows is kept while the page is open, also where it does not change
 * the steps.
 */
export function AggregationField({
  steps,
  defaultSteps,
  methods,
  activation,
  isDisabled,
  onChange,
}: AggregationFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [order, setOrder] = useState<[RowUnit, RowUnit]>(DEFAULT_ROW_ORDER);
  const field = useRef<HTMLDivElement>(null);
  const aggregation: AggregationRows = rowsOf(steps, order);
  const titleOf = (value: AggregationMethodValue) =>
    methods.find((method) => method.value === value)?.title ?? value;
  const stepLines: SummaryLine[] = steps.map((step) => ({
    unit: UNIT_TITLES[step.unit],
    choice: `${TIMING_MARKS[step.timing]} ${titleOf(step.method)}`,
    isChosen: true,
  }));
  const idleLines: SummaryLine[] = aggregation.rows
    .filter((row) => stepIndexOf(steps, row) === null)
    .map((row) => ({ unit: UNIT_TITLES[row.unit], choice: "None", isChosen: false }));
  const together = steps.length === 1 && steps[0]?.unit === "template_and_prompt" ? stepLines[0] : undefined;
  const lines: SummaryLine[] =
    together === undefined
      ? [...stepLines, ...idleLines]
      : [
          { unit: together.unit, choice: together.choice, isChosen: true },
          { unit: "aggregated together", choice: "", isChosen: true },
        ];

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
        title={lines.map((line) => `${line.unit} ${line.choice}`.trim()).join("\n")}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <span className="model-picker-name">
          {lines.map((line, index) => (
            <span key={index} className="aggregation-summary">
              {line.unit !== "" && <span className="aggregation-summary-unit">{line.unit}</span>}
              {line.choice !== "" && (
                <span className={line.isChosen ? "aggregation-chip" : "aggregation-chip idle"}>{line.choice}</span>
              )}
            </span>
          ))}
        </span>
        <span className="model-picker-chevron" aria-hidden>
          ›
        </span>
      </button>
      {isOpen && (
        <AggregationPanel
          anchor={field}
          aggregation={aggregation}
          defaultAggregation={rowsOf(defaultSteps, DEFAULT_ROW_ORDER)}
          methods={methods}
          activation={activation}
          isDisabled={isDisabled}
          onChange={change}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
