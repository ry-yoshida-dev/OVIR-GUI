import { describe, expect, it } from "vitest";
import type { Finding, ResultPicture } from "@/api/types";
import {
  boundText,
  conditionText,
  facetFindingsOf,
  facetValuesOf,
  filterWithout,
  numbersOf,
  percentText,
  rangeDomainOf,
  roundedBound,
  shareInRange,
  valueSharesOf,
} from "@/domain/columnFacets";
import { buildRows, type FindingRow, type TableFilter, type TableRow } from "@/domain/resultTable";
import { UNIT_RANGE } from "@/domain/scoreHistogram";

function finding(overrides: Partial<Finding> & Pick<Finding, "index">): Finding {
  return {
    class_name: "cat",
    matched_prompt: null,
    matched_template: null,
    confidence: 0.5,
    box: null,
    area: null,
    is_accepted: true,
    is_passing: true,
    ...overrides,
  };
}

function picture(path: string, findings: Finding[]): ResultPicture {
  return {
    path,
    name: path,
    frame: null,
    seconds: null,
    width: 100,
    height: 100,
    outdated: null,
    scores: [],
    findings,
  };
}

function rowsOf(...pictures: ResultPicture[]): TableRow[] {
  return buildRows({ profile_key: null, task: "segmentation", pictures }, "hide");
}

function findingRowsOf(rows: TableRow[]): FindingRow[] {
  return rows.filter((row): row is FindingRow => row.kind === "finding");
}

const ROWS = rowsOf(
  picture("a.jpg", [
    finding({ index: 0, class_name: "cat", confidence: 0.2, area: 50 }),
    finding({ index: 1, class_name: "dog", confidence: 0.6, area: 150 }),
    finding({ index: 2, class_name: "cat", confidence: 0.9 }),
  ]),
  picture("b.jpg", []),
);

describe("filterWithout", () => {
  it("drops the condition of the column and keeps the others", () => {
    const filter: TableFilter = {
      class: { kind: "values", values: ["cat"] },
      confidence: { kind: "range", minimum: 0.5, maximum: null },
    };
    expect(filterWithout(filter, "class")).toEqual({ confidence: filter.confidence });
    expect(filter.class).toBeDefined();
  });

  it("keeps every condition when the column has none", () => {
    expect(filterWithout({ class: { kind: "values", values: [] } }, "area")).toEqual({
      class: { kind: "values", values: [] },
    });
  });
});

describe("facetFindingsOf", () => {
  const filter: TableFilter = {
    class: { kind: "values", values: ["cat"] },
    confidence: { kind: "range", minimum: 0.5, maximum: null },
  };

  it("applies every condition but the column's own", () => {
    expect(facetFindingsOf(ROWS, filter, "class").map((row) => row.finding.index)).toEqual([1, 2]);
    expect(facetFindingsOf(ROWS, filter, "confidence").map((row) => row.finding.index)).toEqual([0, 2]);
  });

  it("leaves out status rows", () => {
    expect(facetFindingsOf(ROWS, {}, "media").every((row) => row.kind === "finding")).toBe(true);
    expect(facetFindingsOf(ROWS, {}, "media")).toHaveLength(3);
  });
});

describe("facetValuesOf", () => {
  it("merges the values of the rows with the known values in natural order", () => {
    expect(facetValuesOf(ROWS, "class", ["bird", "dog", "cat10"])).toEqual(["bird", "cat", "cat10", "dog"]);
  });

  it("lists only the known values without rows", () => {
    expect(facetValuesOf([], "class", ["dog", "cat"])).toEqual(["cat", "dog"]);
  });

  it("is empty without rows and known values", () => {
    expect(facetValuesOf([], "class", [])).toEqual([]);
  });
});

describe("valueSharesOf", () => {
  it("gives each value its share of the findings", () => {
    expect(valueSharesOf(["bird", "cat", "dog"], findingRowsOf(ROWS), "class")).toEqual([
      { value: "bird", share: 0 },
      { value: "cat", share: 2 / 3 },
      { value: "dog", share: 1 / 3 },
    ]);
  });

  it("counts findings without a value in the whole", () => {
    expect(valueSharesOf(["50", "150"], findingRowsOf(ROWS), "area")).toEqual([
      { value: "50", share: 1 / 3 },
      { value: "150", share: 1 / 3 },
    ]);
  });

  it("gives zero shares without findings", () => {
    expect(valueSharesOf(["cat"], [], "class")).toEqual([{ value: "cat", share: 0 }]);
  });
});

describe("numbersOf", () => {
  it("collects the numbers of a column, skipping missing ones", () => {
    expect(numbersOf(findingRowsOf(ROWS), "area")).toEqual([50, 150]);
    expect(numbersOf(findingRowsOf(ROWS), "confidence")).toEqual([0.2, 0.6, 0.9]);
  });

  it("collects nothing from a text column", () => {
    expect(numbersOf(findingRowsOf(ROWS), "class")).toEqual([]);
  });
});

describe("rangeDomainOf", () => {
  it("always uses the unit range for confidence", () => {
    expect(rangeDomainOf(ROWS, "confidence")).toEqual(UNIT_RANGE);
  });

  it("spans the numbers of the column", () => {
    expect(rangeDomainOf(ROWS, "area")).toEqual({ lower: 50, upper: 150 });
  });

  it("widens a single number to a span of one", () => {
    const rows = rowsOf(picture("a.jpg", [finding({ index: 0, area: 70 })]));
    expect(rangeDomainOf(rows, "area")).toEqual({ lower: 70, upper: 71 });
  });

  it("uses the unit range when the column has no numbers", () => {
    expect(rangeDomainOf([], "area")).toEqual(UNIT_RANGE);
  });
});

describe("roundedBound", () => {
  it("rounds confidence to two decimals", () => {
    expect(roundedBound(0.456, "confidence")).toBe(0.46);
  });

  it("rounds a frame to a whole number", () => {
    expect(roundedBound(12.6, "frame")).toBe(13);
  });

  it("rounds other columns to one decimal", () => {
    expect(roundedBound(12.34, "area")).toBe(12.3);
    expect(roundedBound(7.06, "x1")).toBe(7.1);
  });
});

describe("boundText", () => {
  it("writes confidence with two decimals", () => {
    expect(boundText(0.5, "confidence")).toBe("0.50");
  });

  it("writes other columns like their cells", () => {
    expect(boundText(12.6, "frame")).toBe("13");
    expect(boundText(12.34, "x1")).toBe("12.3");
  });
});

describe("shareInRange", () => {
  it("is the share of numbers inside the inclusive range", () => {
    expect(shareInRange([0.1, 0.2, 0.5, 0.9], 0.2, 0.5)).toBe(0.5);
  });

  it("is zero without numbers", () => {
    expect(shareInRange([], 0, 1)).toBe(0);
  });

  it("is zero for an empty range", () => {
    expect(shareInRange([0.5], 0.6, 0.4)).toBe(0);
  });
});

describe("percentText", () => {
  it.each([
    [0, "0%"],
    [0.004, "<1%"],
    [0.005, "1%"],
    [0.333, "33%"],
    [1, "100%"],
  ])("writes %d as %s", (share, text) => {
    expect(percentText(share)).toBe(text);
  });
});

describe("conditionText", () => {
  it("writes All without a condition", () => {
    expect(conditionText(undefined, 4, "class")).toBe("All");
  });

  it("writes how many values are chosen", () => {
    expect(conditionText({ kind: "values", values: ["cat", "dog"] }, 5, "class")).toBe("2 of 5");
    expect(conditionText({ kind: "values", values: [] }, 5, "class")).toBe("0 of 5");
  });

  it("writes the bounds of a range", () => {
    expect(conditionText({ kind: "range", minimum: 0.2, maximum: 0.8 }, 0, "confidence")).toBe("0.20 – 0.80");
    expect(conditionText({ kind: "range", minimum: 0.2, maximum: null }, 0, "confidence")).toBe("≥ 0.20");
    expect(conditionText({ kind: "range", minimum: null, maximum: 30 }, 0, "frame")).toBe("≤ 30");
  });

  it("writes All for a range without bounds", () => {
    expect(conditionText({ kind: "range", minimum: null, maximum: null }, 0, "area")).toBe("All");
  });
});
