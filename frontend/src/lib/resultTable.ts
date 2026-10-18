import type { Finding, PictureFindings, ResultsPayload, TaskValue } from "../api/types";

export type ColumnKey =
  | "keep"
  | "media"
  | "frame"
  | "class"
  | "query"
  | "confidence"
  | "runner_up"
  | "area"
  | "x1"
  | "y1"
  | "x2"
  | "y2";

export type ColumnKind = "values" | "range";

export interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  kind: ColumnKind;
  width: number;
}

const KEEP: ColumnDefinition = { key: "keep", label: "Keep", kind: "values", width: 50 };
const MEDIA: ColumnDefinition = { key: "media", label: "Media", kind: "values", width: 140 };
const FRAME: ColumnDefinition = { key: "frame", label: "Frame", kind: "range", width: 92 };
const CLASS: ColumnDefinition = { key: "class", label: "Class", kind: "values", width: 110 };
const QUERY: ColumnDefinition = { key: "query", label: "Query", kind: "values", width: 104 };
const BOX_COLUMNS: ColumnDefinition[] = [
  { key: "x1", label: "x1", kind: "range", width: 54 },
  { key: "y1", label: "y1", kind: "range", width: 54 },
  { key: "x2", label: "x2", kind: "range", width: 54 },
  { key: "y2", label: "y2", kind: "range", width: 54 },
];

export function columnsOf(task: TaskValue): ColumnDefinition[] {
  switch (task) {
    case "classification":
      return [
        KEEP,
        MEDIA,
        FRAME,
        CLASS,
        QUERY,
        { key: "confidence", label: "Score", kind: "range", width: 72 },
        { key: "runner_up", label: "Runner-up", kind: "values", width: 120 },
      ];
    case "detection":
      return [KEEP, MEDIA, FRAME, CLASS, QUERY, { key: "confidence", label: "Confidence", kind: "range", width: 82 }, ...BOX_COLUMNS];
    case "segmentation":
      return [
        KEEP,
        MEDIA,
        FRAME,
        CLASS,
        QUERY,
        { key: "confidence", label: "Confidence", kind: "range", width: 82 },
        { key: "area", label: "Area", kind: "range", width: 70 },
        ...BOX_COLUMNS,
      ];
  }
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
  runnerUp: string | null;
}

export interface FindingRow extends RowBase {
  kind: "finding";
  finding: Finding;
}

export interface StatusRow extends RowBase {
  kind: "status";
  text: string;
}

export type TableRow = FindingRow | StatusRow;

export const KEPT_TEXT = "Kept";
export const REJECTED_TEXT = "Rejected";

export function pictureKeyOf(path: string, frame: number | null): string {
  return `${path}@${frame ?? ""}`;
}

export function rowKeyOf(path: string, frame: number | null, index: number): string {
  return `${pictureKeyOf(path, frame)}#${index}`;
}

export function buildRows(payload: ResultsPayload | null): TableRow[] {
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
      runnerUp: picture.runner_up,
    };
    const listed = picture.findings.filter((finding) => finding.is_above_minimum);
    if (listed.length === 0) {
      rows.push({
        ...base,
        kind: "status",
        key: `${pictureKeyOf(picture.path, picture.frame)}#status`,
        text: payload.task === "classification" ? "Below the class minimum" : "Nothing found",
      });
      return;
    }
    for (const finding of listed) {
      rows.push({ ...base, kind: "finding", key: rowKeyOf(picture.path, picture.frame, finding.index), finding });
    }
  });
  return rows;
}

export function cellValue(row: TableRow, key: ColumnKey): string | number | null {
  switch (key) {
    case "media":
      return row.mediaName;
    case "frame":
      return row.frame;
    case "runner_up":
      return row.runnerUp;
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
    case "query":
      return finding.query;
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

function passes(row: TableRow, key: ColumnKey, condition: ColumnCondition): boolean {
  const value = cellValue(row, key);
  if (value === null) return false;
  if (condition.kind === "values") return condition.values.includes(String(value));
  const number = Number(value);
  return (
    (condition.minimum === null || number >= condition.minimum) &&
    (condition.maximum === null || number <= condition.maximum)
  );
}

export function filterRows(rows: TableRow[], filter: TableFilter): TableRow[] {
  const conditions = Object.entries(filter) as [ColumnKey, ColumnCondition][];
  if (conditions.length === 0) return rows;
  return rows.filter((row) => conditions.every(([key, condition]) => passes(row, key, condition)));
}

export function sortRows(rows: TableRow[], order: SortOrder | null): TableRow[] {
  if (order === null) return rows;
  const direction = order.isDescending ? -1 : 1;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  return [...rows].sort((left, right) => {
    const leftValue = cellValue(left, order.key);
    const rightValue = cellValue(right, order.key);
    if (leftValue === null || rightValue === null) {
      if (leftValue === rightValue) return left.pictureOrder - right.pictureOrder;
      return leftValue === null ? 1 : -1;
    }
    const compared =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : collator.compare(String(leftValue), String(rightValue));
    return compared === 0 ? left.pictureOrder - right.pictureOrder : compared * direction;
  });
}

export function valuesOf(rows: TableRow[], key: ColumnKey): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = cellValue(row, key);
    if (value !== null) values.add(String(value));
  }
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  return [...values].sort(collator.compare);
}

export function spanOf(rows: TableRow[], key: ColumnKey): [number, number] | null {
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

export function formatNumber(value: number, key: ColumnKey): string {
  if (key === "confidence") return value.toFixed(3);
  if (key === "area" || key === "frame") return value.toFixed(0);
  return value.toFixed(1);
}

export function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

export function frameText(frame: number | null, seconds: number | null): string {
  if (frame === null) return "";
  return seconds === null ? `#${frame}` : `${formatSeconds(seconds)} #${frame}`;
}
