import { afterEach, describe, expect, it, vi } from "vitest";
import type { Finding, RankedScore, ResultPicture, TaskValue } from "@/api/types";
import { type ColumnFonts, fittedColumnWidthsOf, type HeaderMarks } from "@/domain/columnWidths";
import { buildRows, type ColumnDefinition, type ColumnKey, columnsOf, type TableRow } from "@/domain/resultTable";

const FONTS: ColumnFonts = { cell: "cell", header: "header" };
const NO_MARKS: HeaderMarks = { sortedKey: null, filteredKeys: new Set() };
const HEADER_CHARACTER_WIDTH = 10;
const CELL_CHARACTER_WIDTH = 6;

/**
 * Canvas 2D context measuring each character of the header font as 10 pixels and of any other font as 6.
 */
class FakeContext {
  font = "";

  measureText(text: string): { width: number } {
    const characterWidth = this.font === FONTS.header ? HEADER_CHARACTER_WIDTH : CELL_CHARACTER_WIDTH;
    return { width: [...text].length * characterWidth };
  }
}

function stubCanvas(context: FakeContext | null): void {
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => context }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function finding(overrides: Partial<Finding> & Pick<Finding, "index">): Finding {
  return {
    class_name: "person",
    matched_prompt: "a person",
    matched_template: null,
    confidence: 0.5,
    box: [10.5, 20, 300, 40],
    area: null,
    is_accepted: true,
    is_passing: true,
    ...overrides,
  };
}

function picture(overrides: Partial<ResultPicture> & Pick<ResultPicture, "path">): ResultPicture {
  return {
    name: overrides.path,
    frame: null,
    seconds: null,
    width: 640,
    height: 480,
    outdated: null,
    scores: [],
    findings: [],
    ...overrides,
  };
}

function rowsOf(pictures: ResultPicture[], task: TaskValue = "detection"): TableRow[] {
  return buildRows({ profile_key: null, task, pictures }, "hide");
}

function columnsNamed(keys: ColumnKey[], task: TaskValue = "detection"): ColumnDefinition[] {
  const columns = columnsOf(task, "videos");
  return keys.map((key) => {
    const column = columns.find((candidate) => candidate.key === key);
    if (column === undefined) throw new Error(`no ${key} column`);
    return column;
  });
}

function widthsOf(
  keys: ColumnKey[],
  rows: TableRow[],
  options: { task?: TaskValue; padding?: number; marks?: HeaderMarks } = {},
): number[] {
  const columns = columnsNamed(keys, options.task);
  return fittedColumnWidthsOf(
    columns,
    rows,
    FONTS,
    columns.map(() => options.padding ?? 10),
    options.marks ?? NO_MARKS,
  );
}

const ROWS = rowsOf([picture({ path: "a.jpg", findings: [finding({ index: 0 })] })]);

describe("fittedColumnWidthsOf", () => {
  it("falls back to the maximum widths without a canvas context", () => {
    stubCanvas(null);
    const columns = columnsNamed(["media", "class"]);
    expect(fittedColumnWidthsOf(columns, ROWS, FONTS, [10, 10], NO_MARKS)).toEqual([240, 180]);
  });

  it("fits the header when it is wider than every cell", () => {
    stubCanvas(new FakeContext());
    // "Media" is 50 wide in the header font, "a.jpg" 30 in the cell font; padding 10 and slack 2.
    expect(widthsOf(["media", "prompt", "x2"], ROWS)).toEqual([62, 72, 42]);
  });

  it("fits the widest cell with its decoration", () => {
    stubCanvas(new FakeContext());
    // "pedestrian" is 60 wide plus the 16-pixel swatch, beyond the 50-pixel header.
    const rows = rowsOf([picture({ path: "a.jpg", findings: [finding({ index: 0, class_name: "pedestrian" })] })]);
    expect(widthsOf(["class"], rows)).toEqual([60 + 16 + 12]);
  });

  it("caps a width at the column's maximum", () => {
    stubCanvas(new FakeContext());
    expect(widthsOf(["confidence"], ROWS)).toEqual([100]);
    const longName = rowsOf([picture({ path: "a-very-long-picture-name-from-a-camera-roll.jpg" })]);
    expect(widthsOf(["media"], longName)).toEqual([240]);
  });

  it("makes room for the checkbox in the keep column", () => {
    stubCanvas(new FakeContext());
    expect(widthsOf(["keep"], ROWS)).toEqual([16 + 12]);
  });

  it("makes room for the sort arrow and the filter funnel in the header", () => {
    stubCanvas(new FakeContext());
    // "Class ▾" is 70 wide; the funnel adds 16.
    const marks: HeaderMarks = { sortedKey: "class", filteredKeys: new Set<ColumnKey>(["class"]) };
    expect(widthsOf(["class"], ROWS, { marks })).toEqual([70 + 16 + 12]);
  });

  it("makes room for the outdated mark beside the media name", () => {
    stubCanvas(new FakeContext());
    const rows = rowsOf([picture({ path: "photo-001.jpg", outdated: "settings changed" })]);
    expect(widthsOf(["media"], rows)).toEqual([78 + 18 + 12]);
  });

  it("makes room for the score bars beside a classification score", () => {
    stubCanvas(new FakeContext());
    const scores: RankedScore[] = ["cat", "dog", "bird"].map((className) => ({
      class_name: className,
      score: 0.3,
      is_reaching_minimum: true,
    }));
    const rows = rowsOf(
      [picture({ path: "a.jpg", scores, findings: [finding({ index: 0, matched_template: "a close-up photo of {}" })] })],
      "classification",
    );
    // "Score" is 50 wide in the header; "0.500" is 30 plus 24 of bars for three classes.
    expect(widthsOf(["confidence"], rows, { task: "classification" })).toEqual([54 + 12]);
    // "a close-up photo of {prompt}" is 168 wide plus the 14-pixel template slot, beyond the 130-pixel header.
    expect(widthsOf(["template"], rows, { task: "classification" })).toEqual([168 + 14 + 12]);
  });

  it("measures the frame column with its time and number", () => {
    stubCanvas(new FakeContext());
    const rows = rowsOf([picture({ path: "clip.mp4", frame: 1234, seconds: 41.1, findings: [finding({ index: 0 })] })]);
    // "0:41.1 #1234" is 12 characters.
    expect(widthsOf(["frame"], rows)).toEqual([72 + 12]);
  });

  it("does not widen any column for a status message", () => {
    stubCanvas(new FakeContext());
    const rows = rowsOf([picture({ path: "a.jpg" })]);
    expect(rows[0]?.kind).toBe("status");
    expect(widthsOf(["class", "prompt", "x1"], rows)).toEqual([62, 72, 32]);
  });

  it("rounds a fractional width up", () => {
    stubCanvas(new FakeContext());
    expect(widthsOf(["x1"], ROWS, { padding: 0.5 })).toEqual([Math.ceil(24 + 0.5 + 2)]);
  });

  it("treats a missing padding as zero", () => {
    stubCanvas(new FakeContext());
    const columns = columnsNamed(["media", "class"]);
    expect(fittedColumnWidthsOf(columns, ROWS, FONTS, [10], NO_MARKS)).toEqual([62, 52 + 2]);
  });

  it("returns no widths for no columns", () => {
    stubCanvas(new FakeContext());
    expect(fittedColumnWidthsOf([], ROWS, FONTS, [], NO_MARKS)).toEqual([]);
  });
});
