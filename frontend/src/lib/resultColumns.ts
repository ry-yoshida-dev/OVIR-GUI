export type ColumnKey =
  | "keep"
  | "media"
  | "frame"
  | "class"
  | "prompt"
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
  maxWidth: number;
  isNumeric: boolean;
}

const KEEP: ColumnDefinition = {
  key: "keep",
  label: "Keep",
  kind: "values",
  maxWidth: 40,
  isNumeric: false,
};
const MEDIA: ColumnDefinition = {
  key: "media",
  label: "Media",
  kind: "values",
  maxWidth: 240,
  isNumeric: false,
};
const FRAME: ColumnDefinition = {
  key: "frame",
  label: "Frame",
  kind: "range",
  maxWidth: 120,
  isNumeric: false,
};
const CLASS: ColumnDefinition = {
  key: "class",
  label: "Class",
  kind: "values",
  maxWidth: 180,
  isNumeric: false,
};
const QUERY: ColumnDefinition = {
  key: "prompt",
  label: "Matched prompt",
  kind: "values",
  maxWidth: 180,
  isNumeric: false,
};
const CONFIDENCE: ColumnDefinition = {
  key: "confidence",
  label: "Confidence",
  kind: "range",
  maxWidth: 100,
  isNumeric: true,
};
const BOX_COLUMNS: ColumnDefinition[] = [
  {
    key: "x1",
    label: "x1",
    kind: "range",
    maxWidth: 72,
    isNumeric: true,
  },
  {
    key: "y1",
    label: "y1",
    kind: "range",
    maxWidth: 72,
    isNumeric: true,
  },
  {
    key: "x2",
    label: "x2",
    kind: "range",
    maxWidth: 72,
    isNumeric: true,
  },
  {
    key: "y2",
    label: "y2",
    kind: "range",
    maxWidth: 72,
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
    maxWidth: 90,
    isNumeric: true,
  },
  {
    key: "runner_up",
    label: "Runner-up",
    kind: "values",
    maxWidth: 180,
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
    maxWidth: 90,
    isNumeric: true,
  },
  ...BOX_COLUMNS,
];
