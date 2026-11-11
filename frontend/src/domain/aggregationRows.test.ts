import { describe, expect, it } from "vitest";
import type { AggregationStep } from "@/api/types";
import {
  type AggregationRow,
  type AggregationRows,
  canAggregateTogether,
  DEFAULT_ROW_ORDER,
  isSameSteps,
  rowsOf,
  stepIndexOf,
  stepsOf,
  swapped,
  withMethod,
  withTiming,
} from "@/domain/aggregationRows";

const templateOnEmbedding: AggregationStep = { unit: "template", timing: "embedding", method: "mean" };
const promptOnSimilarity: AggregationStep = { unit: "prompt", timing: "similarity", method: "max" };
const templateOnSimilarity: AggregationStep = { unit: "template", timing: "similarity", method: "min" };
const togetherOnSimilarity: AggregationStep = {
  unit: "template_and_prompt",
  timing: "similarity",
  method: "logsumexp",
};

function separate(first: AggregationRow, second: AggregationRow): AggregationRows {
  return { rows: [first, second], isTogether: false };
}

describe("rowsOf", () => {
  it("shows both rows at no timing for no steps", () => {
    expect(rowsOf([], DEFAULT_ROW_ORDER)).toEqual({
      rows: [
        { unit: "template", timing: "none", method: "max" },
        { unit: "prompt", timing: "none", method: "max" },
      ],
      isTogether: false,
    });
  });

  it("shows each step on its row in the given order", () => {
    expect(rowsOf([templateOnEmbedding, promptOnSimilarity], ["prompt", "template"])).toEqual({
      rows: [
        { unit: "prompt", timing: "similarity", method: "max" },
        { unit: "template", timing: "embedding", method: "mean" },
      ],
      isTogether: false,
    });
  });

  it("puts the row whose step runs first on top when both run at the same timing", () => {
    const rows = rowsOf([promptOnSimilarity, templateOnSimilarity], DEFAULT_ROW_ORDER);
    expect(rows.rows.map((row) => row.unit)).toEqual(["prompt", "template"]);
  });

  it("keeps the given order when the steps already run in it", () => {
    const rows = rowsOf([templateOnSimilarity, promptOnSimilarity], DEFAULT_ROW_ORDER);
    expect(rows.rows.map((row) => row.unit)).toEqual(["template", "prompt"]);
  });

  it("shows one step on both units as both rows aggregated together", () => {
    expect(rowsOf([togetherOnSimilarity], ["prompt", "template"])).toEqual({
      rows: [
        { unit: "prompt", timing: "similarity", method: "logsumexp" },
        { unit: "template", timing: "similarity", method: "logsumexp" },
      ],
      isTogether: true,
    });
  });
});

describe("canAggregateTogether", () => {
  it("allows rows at the same timing", () => {
    expect(
      canAggregateTogether(
        separate(
          { unit: "template", timing: "similarity", method: "max" },
          { unit: "prompt", timing: "similarity", method: "mean" },
        ),
      ),
    ).toBe(true);
  });

  it("refuses rows at different timings", () => {
    expect(
      canAggregateTogether(
        separate(
          { unit: "template", timing: "embedding", method: "mean" },
          { unit: "prompt", timing: "similarity", method: "max" },
        ),
      ),
    ).toBe(false);
  });

  it("refuses rows that both run at no timing", () => {
    expect(canAggregateTogether(rowsOf([], DEFAULT_ROW_ORDER))).toBe(false);
  });
});

describe("stepsOf", () => {
  it("returns no steps for rows at no timing", () => {
    expect(stepsOf(rowsOf([], DEFAULT_ROW_ORDER))).toEqual([]);
  });

  it("puts steps on text vectors before steps on similarities", () => {
    const rows = separate(
      { unit: "template", timing: "similarity", method: "max" },
      { unit: "prompt", timing: "embedding", method: "mean" },
    );
    expect(stepsOf(rows)).toEqual([
      { unit: "prompt", timing: "embedding", method: "mean" },
      { unit: "template", timing: "similarity", method: "max" },
    ]);
  });

  it("keeps row order for steps at the same timing", () => {
    const rows = separate(
      { unit: "prompt", timing: "similarity", method: "max" },
      { unit: "template", timing: "similarity", method: "min" },
    );
    expect(stepsOf(rows)).toEqual([promptOnSimilarity, templateOnSimilarity]);
  });

  it("makes rows aggregated together one step with the method of the first row", () => {
    const rows: AggregationRows = {
      rows: [
        { unit: "template", timing: "similarity", method: "median" },
        { unit: "prompt", timing: "similarity", method: "max" },
      ],
      isTogether: true,
    };
    expect(stepsOf(rows)).toEqual([{ unit: "template_and_prompt", timing: "similarity", method: "median" }]);
  });

  it("splits rows marked together once they run at different timings", () => {
    const rows: AggregationRows = {
      rows: [
        { unit: "template", timing: "embedding", method: "mean" },
        { unit: "prompt", timing: "similarity", method: "max" },
      ],
      isTogether: true,
    };
    expect(stepsOf(rows)).toEqual([templateOnEmbedding, promptOnSimilarity]);
  });

  it("returns no steps for rows marked together at no timing", () => {
    const rows: AggregationRows = { ...rowsOf([], DEFAULT_ROW_ORDER), isTogether: true };
    expect(stepsOf(rows)).toEqual([]);
  });

  it.each([
    [[]],
    [[templateOnEmbedding]],
    [[templateOnEmbedding, promptOnSimilarity]],
    [[promptOnSimilarity, templateOnSimilarity]],
    [[templateOnSimilarity, promptOnSimilarity]],
    [[togetherOnSimilarity]],
  ])("round-trips steps through rows: %o", (steps: AggregationStep[]) => {
    expect(stepsOf(rowsOf(steps, DEFAULT_ROW_ORDER))).toEqual(steps);
  });
});

describe("withTiming", () => {
  const rows = rowsOf([promptOnSimilarity], DEFAULT_ROW_ORDER);

  it("aggregates text vectors by their mean", () => {
    expect(withTiming(rows, 0, "embedding").rows[0]).toEqual({
      unit: "template",
      timing: "embedding",
      method: "mean",
    });
  });

  it("keeps the method when moving to similarities or no timing", () => {
    expect(withTiming(rows, 1, "none").rows[1]).toEqual({ unit: "prompt", timing: "none", method: "max" });
    const moved = withTiming(withMethod(rows, 0, "median"), 0, "similarity");
    expect(moved.rows[0]).toEqual({ unit: "template", timing: "similarity", method: "median" });
  });

  it("leaves the other row and the input unchanged", () => {
    const moved = withTiming(rows, 0, "embedding");
    expect(moved.rows[1]).toBe(rows.rows[1]);
    expect(rows.rows[0].timing).toBe("none");
  });
});

describe("withMethod", () => {
  it("changes only the given row", () => {
    const rows = rowsOf([templateOnSimilarity, promptOnSimilarity], DEFAULT_ROW_ORDER);
    const changed = withMethod(rows, 1, "median");
    expect(changed.rows.map((row) => row.method)).toEqual(["min", "median"]);
  });

  it("changes both rows aggregated together", () => {
    const rows = rowsOf([togetherOnSimilarity], DEFAULT_ROW_ORDER);
    expect(withMethod(rows, 1, "mean").rows.map((row) => row.method)).toEqual(["mean", "mean"]);
  });
});

describe("swapped", () => {
  it("swaps the order of the rows and keeps aggregation together", () => {
    const rows = rowsOf([togetherOnSimilarity], DEFAULT_ROW_ORDER);
    const result = swapped(rows);
    expect(result.rows.map((row) => row.unit)).toEqual(["prompt", "template"]);
    expect(result.isTogether).toBe(true);
  });
});

describe("stepIndexOf", () => {
  const steps = [templateOnEmbedding, promptOnSimilarity];

  it("finds the step of a row", () => {
    expect(stepIndexOf(steps, { unit: "prompt", timing: "similarity", method: "max" })).toBe(1);
    expect(stepIndexOf(steps, { unit: "template", timing: "embedding", method: "mean" })).toBe(0);
  });

  it("returns null for a row at no timing", () => {
    expect(stepIndexOf(steps, { unit: "prompt", timing: "none", method: "max" })).toBeNull();
  });

  it("returns null when no step holds the row", () => {
    expect(stepIndexOf([templateOnEmbedding], { unit: "prompt", timing: "similarity", method: "max" })).toBeNull();
  });

  it("finds the step aggregating both rows together for either row", () => {
    expect(stepIndexOf([togetherOnSimilarity], { unit: "template", timing: "similarity", method: "max" })).toBe(0);
    expect(stepIndexOf([togetherOnSimilarity], { unit: "prompt", timing: "similarity", method: "max" })).toBe(0);
  });
});

describe("isSameSteps", () => {
  it("accepts equal lists, including empty ones", () => {
    expect(isSameSteps([], [])).toBe(true);
    expect(isSameSteps([templateOnEmbedding, promptOnSimilarity], [{ ...templateOnEmbedding }, { ...promptOnSimilarity }])).toBe(true);
  });

  it("rejects lists of different lengths", () => {
    expect(isSameSteps([templateOnEmbedding], [templateOnEmbedding, promptOnSimilarity])).toBe(false);
    expect(isSameSteps([templateOnEmbedding], [])).toBe(false);
  });

  it("rejects lists differing in unit, timing, method or order", () => {
    expect(isSameSteps([templateOnSimilarity], [{ ...templateOnSimilarity, unit: "prompt" }])).toBe(false);
    expect(isSameSteps([templateOnSimilarity], [{ ...templateOnSimilarity, timing: "embedding" }])).toBe(false);
    expect(isSameSteps([templateOnSimilarity], [{ ...templateOnSimilarity, method: "max" }])).toBe(false);
    expect(
      isSameSteps([promptOnSimilarity, templateOnSimilarity], [templateOnSimilarity, promptOnSimilarity]),
    ).toBe(false);
  });
});
