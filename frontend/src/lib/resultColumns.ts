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

export type ResultScope = "images" | "videos";

export interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  kind: ColumnKind;
  width: number;
}

const KEEP: ColumnDefinition = {
  key: "keep",
  label: "Keep",
  kind: "values",
  width: 50,
};
const MEDIA: ColumnDefinition = {
  key: "media",
  label: "Media",
  kind: "values",
  width: 140,
};
const FRAME: ColumnDefinition = {
  key: "frame",
  label: "Frame",
  kind: "range",
  width: 92,
};
const CLASS: ColumnDefinition = {
  key: "class",
  label: "Class",
  kind: "values",
  width: 110,
};
const QUERY: ColumnDefinition = {
  key: "query",
  label: "Query",
  kind: "values",
  width: 104,
};
const CONFIDENCE: ColumnDefinition = {
  key: "confidence",
  label: "Confidence",
  kind: "range",
  width: 82,
};
const BOX_COLUMNS: ColumnDefinition[] = [
  { key: "x1", label: "x1", kind: "range", width: 54 },
  { key: "y1", label: "y1", kind: "range", width: 54 },
  { key: "x2", label: "x2", kind: "range", width: 54 },
  { key: "y2", label: "y2", kind: "range", width: 54 },
];

export const SCORE_COLUMNS: ColumnDefinition[] = [
  KEEP,
  MEDIA,
  FRAME,
  CLASS,
  QUERY,
  { key: "confidence", label: "Score", kind: "range", width: 72 },
  { key: "runner_up", label: "Runner-up", kind: "values", width: 120 },
];

export const BOX_FINDING_COLUMNS: ColumnDefinition[] = [
  KEEP,
  MEDIA,
  FRAME,
  CLASS,
  QUERY,
  CONFIDENCE,
  ...BOX_COLUMNS,
];

export const MASK_FINDING_COLUMNS: ColumnDefinition[] = [
  KEEP,
  MEDIA,
  FRAME,
  CLASS,
  QUERY,
  CONFIDENCE,
  { key: "area", label: "Area", kind: "range", width: 70 },
  ...BOX_COLUMNS,
];
