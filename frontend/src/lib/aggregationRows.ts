import type {
  AggregationMethodValue,
  AggregationStep,
  AggregationTimingValue,
  AggregationUnitValue,
} from "../api/types";

export type RowUnit = "template" | "prompt";
export type RowTiming = "none" | AggregationTimingValue;

export interface AggregationRow {
  unit: RowUnit;
  timing: RowTiming;
  method: AggregationMethodValue;
}

export interface AggregationRows {
  rows: [AggregationRow, AggregationRow];
  isTogether: boolean;
}

export const DEFAULT_ROW_ORDER: [RowUnit, RowUnit] = ["template", "prompt"];
export const EMBEDDING_METHOD: AggregationMethodValue = "mean";
const DEFAULT_SIMILARITY_METHOD: AggregationMethodValue = "max";
const TOGETHER_UNIT: AggregationUnitValue = "template_and_prompt";
const TIMING_ORDER: AggregationTimingValue[] = ["embedding", "similarity"];

export const UNIT_TITLES: Record<AggregationUnitValue, string> = {
  template: "Templates",
  prompt: "Prompts",
  template_and_prompt: "Templates & prompts",
};

export const TIMING_MARKS: Record<AggregationTimingValue, string> = {
  embedding: "①",
  similarity: "②",
};

/**
 * The two setting rows, Templates and Prompts, showing a list of aggregation steps: each row runs at no timing, on
 * text vectors or on similarities, and one step on both units shows as both rows aggregated together. Rows keep the
 * given order unless both run at the same timing, where the order of the steps decides which runs first.
 */
export function rowsOf(steps: readonly AggregationStep[], order: readonly [RowUnit, RowUnit]): AggregationRows {
  const together = steps.find((step) => step.unit === TOGETHER_UNIT);
  if (together !== undefined) {
    const row = (unit: RowUnit): AggregationRow => ({ unit, timing: together.timing, method: together.method });
    return { rows: [row(order[0]), row(order[1])], isTogether: true };
  }
  const row = (unit: RowUnit): AggregationRow => {
    const step = steps.find((candidate) => candidate.unit === unit);
    return step === undefined
      ? { unit, timing: "none", method: DEFAULT_SIMILARITY_METHOD }
      : { unit, timing: step.timing, method: step.method };
  };
  const [first, second] = [row(order[0]), row(order[1])];
  const stepUnits = steps.map((step) => step.unit);
  const isReversed =
    first.timing !== "none" &&
    first.timing === second.timing &&
    stepUnits.indexOf(first.unit) > stepUnits.indexOf(second.unit);
  return { rows: isReversed ? [second, first] : [first, second], isTogether: false };
}

/**
 * Whether both rows run at the same timing, so they can be aggregated together in one step.
 */
export function canAggregateTogether({ rows: [first, second] }: AggregationRows): boolean {
  return first.timing !== "none" && first.timing === second.timing;
}

/**
 * Aggregation steps of the rows: steps on text vectors first, then steps on similarities, each in row order; both
 * rows aggregated together are one step with the method of the first row.
 */
export function stepsOf(aggregation: AggregationRows): AggregationStep[] {
  const [first] = aggregation.rows;
  if (aggregation.isTogether && canAggregateTogether(aggregation) && first.timing !== "none") {
    return [{ unit: TOGETHER_UNIT, timing: first.timing, method: first.method }];
  }
  const steps: AggregationStep[] = [];
  for (const row of aggregation.rows) {
    if (row.timing !== "none") steps.push({ unit: row.unit, timing: row.timing, method: row.method });
  }
  return steps.sort((left, right) => TIMING_ORDER.indexOf(left.timing) - TIMING_ORDER.indexOf(right.timing));
}

/**
 * Rows with one row moved to another timing, aggregating text vectors by their mean.
 */
export function withTiming(aggregation: AggregationRows, index: number, timing: RowTiming): AggregationRows {
  const rows = aggregation.rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, timing, method: timing === "embedding" ? EMBEDDING_METHOD : row.method } : row,
  ) as [AggregationRow, AggregationRow];
  return { ...aggregation, rows };
}

/**
 * Rows with the method of one row changed; rows aggregated together share it.
 */
export function withMethod(
  aggregation: AggregationRows,
  index: number,
  method: AggregationMethodValue,
): AggregationRows {
  const rows = aggregation.rows.map((row, rowIndex) =>
    rowIndex === index || aggregation.isTogether ? { ...row, method } : row,
  ) as [AggregationRow, AggregationRow];
  return { ...aggregation, rows };
}

/**
 * Rows with their order swapped.
 */
export function swapped(aggregation: AggregationRows): AggregationRows {
  const [first, second] = aggregation.rows;
  return { ...aggregation, rows: [second, first] };
}

/**
 * Position in the steps of the step a row belongs to; null for a row at no timing.
 */
export function stepIndexOf(steps: readonly AggregationStep[], row: AggregationRow): number | null {
  if (row.timing === "none") return null;
  const index = steps.findIndex((step) => step.unit === row.unit || step.unit === TOGETHER_UNIT);
  return index < 0 ? null : index;
}

/**
 * Whether two lists of steps are the same.
 */
export function isSameSteps(left: readonly AggregationStep[], right: readonly AggregationStep[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (step, index) =>
        step.unit === right[index]?.unit && step.timing === right[index]?.timing && step.method === right[index]?.method,
    )
  );
}
