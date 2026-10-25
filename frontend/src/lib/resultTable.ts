import type {
  Finding,
  PictureFindings,
  RankedScore,
  ResultsPayload,
  TaskValue,
} from "../api/types";
import type { BelowMinimumStyle } from "./displayOptions";
import type { ColumnDefinition, ColumnKey, ResultScope } from "./resultColumns";
import { taskViewOf } from "./taskViews";
import { templateLabelOf } from "./textTemplate";
import { formatSeconds } from "./videoTime";

export type {
  ColumnDefinition,
  ColumnKey,
  ColumnKind,
  ResultScope,
} from "./resultColumns";

export function columnsOf(
  task: TaskValue,
  scope: ResultScope,
): ColumnDefinition[] {
  const columns = taskViewOf(task).columns;
  return scope === "videos"
    ? columns
    : columns.filter((column) => column.key !== "frame");
}

export function isRowInScope(row: TableRow, scope: ResultScope): boolean {
  return scope === "videos"
    ? row.frame !== null && row.kind === "finding"
    : row.frame === null;
}

export function filterOfScope(
  filter: TableFilter,
  scope: ResultScope,
): TableFilter {
  if (scope === "videos" || filter.frame === undefined) return filter;
  const { frame: _frame, ...rest } = filter;
  return rest;
}

export type ColumnCondition =
  | { kind: "values"; values: string[] }
  | { kind: "range"; minimum: number | null; maximum: number | null };

export type TableFilter = Partial<Record<ColumnKey, ColumnCondition>>;

export interface SortOrder {
  key: ColumnKey;
  isDescending: boolean;
}

interface RowBase {
  key: string;
  path: string;
  frame: number | null;
  seconds: number | null;
  mediaName: string;
  pictureOrder: number;
  outdated: string | null;
  scores: RankedScore[];
}

export interface FindingRow extends RowBase {
  kind: "finding";
  finding: Finding;
}

export interface StatusRow extends RowBase {
  kind: "status";
  text: string;
  isBelowMinimum: boolean;
}

export type TableRow = FindingRow | StatusRow;

export const KEPT_TEXT = "Kept";
export const REJECTED_TEXT = "Rejected";

export function pictureKeyOf(path: string, frame: number | null): string {
  return `${path}@${frame ?? ""}`;
}

export function rowKeyOf(
  path: string,
  frame: number | null,
  index: number,
): string {
  return `${pictureKeyOf(path, frame)}#${index}`;
}

export function buildRows(
  payload: ResultsPayload | null,
  belowMinimum: BelowMinimumStyle,
): TableRow[] {
  if (payload === null) return [];
  const rows: TableRow[] = [];
  payload.pictures.forEach((picture, pictureOrder) => {
    const base: RowBase = {
      key: "",
      path: picture.path,
      frame: picture.frame,
      seconds: picture.seconds,
      mediaName: picture.name,
      pictureOrder,
      outdated: picture.outdated,
      scores: picture.scores,
    };
    const listed =
      belowMinimum === "dim"
        ? picture.findings
        : picture.findings.filter((finding) => finding.is_passing);
    if (listed.length === 0) {
      rows.push({
        ...base,
        kind: "status",
        key: `${pictureKeyOf(picture.path, picture.frame)}#status`,
        text: taskViewOf(payload.task).emptyPictureText,
        isBelowMinimum: picture.findings.length > 0,
      });
      return;
    }
    for (const finding of listed) {
      rows.push({
        ...base,
        kind: "finding",
        key: rowKeyOf(picture.path, picture.frame, finding.index),
        finding,
      });
    }
  });
  return rows;
}

export function cellValue(
  row: TableRow,
  key: ColumnKey,
): string | number | null {
  switch (key) {
    case "media":
      return row.mediaName;
    case "frame":
      return row.frame;
    default:
      break;
  }
  if (row.kind === "status") return null;
  const finding = row.finding;
  switch (key) {
    case "keep":
      return finding.is_accepted ? KEPT_TEXT : REJECTED_TEXT;
    case "class":
      return finding.class_name;
    case "prompt":
      return finding.matched_prompt;
    case "template":
      return finding.matched_template === null ? null : templateLabelOf(finding.matched_template);
    case "confidence":
      return finding.confidence;
    case "area":
      return finding.area;
    case "x1":
      return finding.box?.[0] ?? null;
    case "y1":
      return finding.box?.[1] ?? null;
    case "x2":
      return finding.box?.[2] ?? null;
    case "y2":
      return finding.box?.[3] ?? null;
  }
}

function passes(
  row: TableRow,
  key: ColumnKey,
  condition: ColumnCondition,
): boolean {
  const value = cellValue(row, key);
  if (value === null) return false;
  if (condition.kind === "values")
    return condition.values.includes(String(value));
  const number = Number(value);
  return (
    (condition.minimum === null || number >= condition.minimum) &&
    (condition.maximum === null || number <= condition.maximum)
  );
}

export function filterRows(rows: TableRow[], filter: TableFilter): TableRow[] {
  const conditions = Object.entries(filter) as [ColumnKey, ColumnCondition][];
  if (conditions.length === 0) return rows;
  return rows.filter((row) =>
    conditions.every(([key, condition]) => passes(row, key, condition)),
  );
}

export function sortRows(
  rows: TableRow[],
  order: SortOrder | null,
): TableRow[] {
  if (order === null) return rows;
  const direction = order.isDescending ? -1 : 1;
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return [...rows].sort((left, right) => {
    const leftValue = cellValue(left, order.key);
    const rightValue = cellValue(right, order.key);
    if (leftValue === null || rightValue === null) {
      if (leftValue === rightValue)
        return left.pictureOrder - right.pictureOrder;
      return leftValue === null ? 1 : -1;
    }
    const compared =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : collator.compare(String(leftValue), String(rightValue));
    return compared === 0
      ? left.pictureOrder - right.pictureOrder
      : compared * direction;
  });
}

export function valuesOf(rows: TableRow[], key: ColumnKey): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = cellValue(row, key);
    if (value !== null) values.add(String(value));
  }
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return [...values].sort(collator.compare);
}

export function spanOf(
  rows: TableRow[],
  key: ColumnKey,
): [number, number] | null {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = cellValue(row, key);
    if (typeof value === "number") {
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  return minimum <= maximum ? [minimum, maximum] : null;
}

export function listedIndices(rows: TableRow[]): Map<string, Set<number>> {
  const listed = new Map<string, Set<number>>();
  for (const row of rows) {
    if (row.kind !== "finding") continue;
    const pictureKey = pictureKeyOf(row.path, row.frame);
    let indices = listed.get(pictureKey);
    if (indices === undefined) {
      indices = new Set();
      listed.set(pictureKey, indices);
    }
    indices.add(row.finding.index);
  }
  return listed;
}

export function groupFindings(rows: TableRow[]): PictureFindings[] {
  const groups = new Map<string, PictureFindings>();
  for (const row of rows) {
    if (row.kind !== "finding") continue;
    const pictureKey = pictureKeyOf(row.path, row.frame);
    let group = groups.get(pictureKey);
    if (group === undefined) {
      group = { path: row.path, frame: row.frame, indices: [] };
      groups.set(pictureKey, group);
    }
    group.indices.push(row.finding.index);
  }
  return [...groups.values()];
}

export function isExportedRow(row: TableRow): boolean {
  return row.kind === "finding" && row.finding.is_accepted && row.finding.is_passing;
}

/**
 * Pictures some rows list, each with its exported findings; a picture listed without any keeps an empty list.
 */
export function listedPictures(rows: TableRow[]): PictureFindings[] {
  const groups = new Map<string, PictureFindings>();
  for (const row of rows) {
    const pictureKey = pictureKeyOf(row.path, row.frame);
    let group = groups.get(pictureKey);
    if (group === undefined) {
      group = { path: row.path, frame: row.frame, indices: [] };
      groups.set(pictureKey, group);
    }
    if (row.kind === "finding" && isExportedRow(row)) group.indices.push(row.finding.index);
  }
  return [...groups.values()];
}

export function formatNumber(value: number, key: ColumnKey): string {
  if (key === "confidence") return value.toFixed(3);
  if (key === "area" || key === "frame") return value.toFixed(0);
  return value.toFixed(1);
}

export function frameText(
  frame: number | null,
  seconds: number | null,
): string {
  if (frame === null) return "";
  return seconds === null ? `#${frame}` : `${formatSeconds(seconds)} #${frame}`;
}
