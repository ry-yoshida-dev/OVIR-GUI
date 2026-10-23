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
  isNumeric: boolean;
}

const KEEP: ColumnDefinition = {
  key: "keep",
  label: "Keep",
  kind: "values",
  width: 50,
  isNumeric: false,
};
const MEDIA: ColumnDefinition = {
  key: "media",
  label: "Media",
  kind: "values",
  width: 140,
  isNumeric: false,
};
const FRAME: ColumnDefinition = {
  key: "frame",
  label: "Frame",
  kind: "range",
  width: 92,
  isNumeric: false,
};
const CLASS: ColumnDefinition = {
  key: "class",
  label: "Class",
  kind: "values",
  width: 110,
  isNumeric: false,
};
const QUERY: ColumnDefinition = {
  key: "query",
  label: "Query",
  kind: "values",
  width: 104,
  isNumeric: false,
};
const CONFIDENCE: ColumnDefinition = {
  key: "confidence",
  label: "Confidence",
  kind: "range",
  width: 82,
  isNumeric: true,
};
const BOX_COLUMNS: ColumnDefinition[] = [
  {
    key: "x1",
    label: "x1",
    kind: "range",
    width: 54,
    isNumeric: true,
  },
  {
    key: "y1",
    label: "y1",
    kind: "range",
    width: 54,
    isNumeric: true,
  },
  {
    key: "x2",
    label: "x2",
    kind: "range",
    width: 54,
    isNumeric: true,
  },
  {
    key: "y2",
    label: "y2",
    kind: "range",
    width: 54,
    isNumeric: true,
  },
];

export const SCORE_COLUMNS: ColumnDefinition[] = [
  KEEP,
  MEDIA,
  FRAME,
  CLASS,
  QUERY,
  {
    key: "confidence",
    label: "Score",
    kind: "range",
    width: 72,
    isNumeric: true,
  },
  {
    key: "runner_up",
    label: "Runner-up",
    kind: "values",
    width: 120,
    isNumeric: false,
  },
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
  {
    key: "area",
    label: "Area",
    kind: "range",
    width: 70,
    isNumeric: true,
  },
  ...BOX_COLUMNS,
];
