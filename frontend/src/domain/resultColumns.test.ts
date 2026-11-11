import { describe, expect, it } from "vitest";
import {
  BOX_FINDING_COLUMNS,
  type ColumnDefinition,
  MASK_FINDING_COLUMNS,
  SCORE_COLUMNS,
} from "@/domain/resultColumns";

function keysOf(columns: ColumnDefinition[]): string[] {
  return columns.map((column) => column.key);
}

describe("SCORE_COLUMNS", () => {
  it("lists the columns of a classification table", () => {
    expect(keysOf(SCORE_COLUMNS)).toEqual(["keep", "media", "frame", "class", "prompt", "template", "confidence"]);
  });

  it("calls the confidence a score", () => {
    expect(SCORE_COLUMNS.find((column) => column.key === "confidence")?.label).toBe("Score");
  });
});

describe("BOX_FINDING_COLUMNS", () => {
  it("lists the columns of a detection table", () => {
    expect(keysOf(BOX_FINDING_COLUMNS)).toEqual([
      "keep",
      "media",
      "frame",
      "class",
      "prompt",
      "confidence",
      "x1",
      "y1",
      "x2",
      "y2",
    ]);
  });
});

describe("MASK_FINDING_COLUMNS", () => {
  it("lists the columns of a segmentation table with the area before the box", () => {
    expect(keysOf(MASK_FINDING_COLUMNS)).toEqual([
      "keep",
      "media",
      "frame",
      "class",
      "prompt",
      "confidence",
      "area",
      "x1",
      "y1",
      "x2",
      "y2",
    ]);
  });
});

describe("column definitions", () => {
  const all = [...SCORE_COLUMNS, ...BOX_FINDING_COLUMNS, ...MASK_FINDING_COLUMNS];

  it("filters by range exactly the numeric columns and the frame", () => {
    for (const column of all) {
      expect(column.kind === "range").toBe(column.isNumeric || column.key === "frame");
    }
  });

  it("does not filter the box coordinates or the area", () => {
    const unfiltered = all.filter((column) => !column.isFilterable).map((column) => column.key);
    expect(new Set(unfiltered)).toEqual(new Set(["x1", "y1", "x2", "y2", "area"]));
  });

  it("gives every column a positive maximum width", () => {
    for (const column of all) expect(column.maxWidth).toBeGreaterThan(0);
  });
});
