import type { ColumnDefinition, ColumnKey } from "./resultColumns";
import { formatNumber, frameText, runnerUpTextOf, type TableRow } from "./resultTable";

const CHECKBOX_WIDTH = 16;
const SWATCH_WIDTH = 16;
const OUTDATED_MARK_WIDTH = 18;
const FUNNEL_WIDTH = 16;
const ROUNDING_SLACK = 2;

export interface ColumnFonts {
  cell: string;
  header: string;
}

export interface HeaderMarks {
  sortedKey: ColumnKey | null;
  filteredKeys: ReadonlySet<ColumnKey>;
}

function cellTextOf(row: TableRow, key: ColumnKey): string {
  switch (key) {
    case "keep":
      return "";
    case "media":
      return row.mediaName;
    case "frame":
      return frameText(row.frame, row.seconds);
    case "runner_up":
      return runnerUpTextOf(row.scores) ?? "";
    default:
      break;
  }
  if (row.kind === "status") return "";
  const finding = row.finding;
  switch (key) {
    case "class":
      return finding.class_name;
    case "prompt":
      return finding.matched_prompt;
    case "confidence":
      return formatNumber(finding.confidence, "confidence");
    case "area":
      return finding.area === null ? "" : formatNumber(finding.area, "area");
    case "x1":
    case "y1":
    case "x2":
    case "y2": {
      const value = finding.box?.[["x1", "y1", "x2", "y2"].indexOf(key)];
      return value === undefined ? "" : formatNumber(value, key);
    }
  }
}

function decorationWidthOf(row: TableRow, key: ColumnKey): number {
  switch (key) {
    case "keep":
      return row.kind === "finding" ? CHECKBOX_WIDTH : 0;
    case "media":
      return row.outdated === null ? 0 : OUTDATED_MARK_WIDTH;
    case "class":
      return row.kind === "finding" ? SWATCH_WIDTH : 0;
    default:
      return 0;
  }
}

/**
 * Width of each column that fits its header and every cell, capped at the column's maximum.
 *
 * The status rows' message spans the trailing columns, so it does not widen any of them.
 */
export function fittedColumnWidthsOf(
  columns: ColumnDefinition[],
  rows: TableRow[],
  fonts: ColumnFonts,
  paddings: number[],
  marks: HeaderMarks,
): number[] {
  const context = document.createElement("canvas").getContext("2d");
  if (context === null) return columns.map((column) => column.maxWidth);
  const measure = (text: string, font: string): number => {
    context.font = font;
    return context.measureText(text).width;
  };
  return columns.map((column, index) => {
    const headerText =
      column.key === "keep" ? "" : `${column.label}${marks.sortedKey === column.key ? " ▾" : ""}`;
    const headerWidth =
      measure(headerText, fonts.header) +
      (column.key === "keep" ? CHECKBOX_WIDTH : 0) +
      (marks.filteredKeys.has(column.key) ? FUNNEL_WIDTH : 0);
    const widestByDecoration = new Map<string, number>();
    for (const row of rows) {
      const text = cellTextOf(row, column.key);
      const decoration = decorationWidthOf(row, column.key);
      widestByDecoration.set(text, Math.max(widestByDecoration.get(text) ?? 0, decoration));
    }
    context.font = fonts.cell;
    let cellWidth = 0;
    for (const [text, decoration] of widestByDecoration) {
      cellWidth = Math.max(cellWidth, context.measureText(text).width + decoration);
    }
    const contentWidth = Math.max(headerWidth, cellWidth) + (paddings[index] ?? 0) + ROUNDING_SLACK;
    return Math.ceil(Math.min(contentWidth, column.maxWidth));
  });
}
