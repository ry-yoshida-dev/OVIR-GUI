import type { TaskValue } from "../api/types";
import type { DisplayOptions } from "./displayOptions";
import { BOX_FINDING_COLUMNS, type ColumnDefinition, MASK_FINDING_COLUMNS, SCORE_COLUMNS } from "./resultColumns";

export type ToggleDisplayKey = {
  [Key in keyof DisplayOptions]: DisplayOptions[Key] extends boolean ? Key : never;
}[keyof DisplayOptions];

export interface DisplayToggle {
  key: ToggleDisplayKey;
  label: string;
}

export interface TaskView {
  task: TaskValue;
  label: string;
  resultTitle: string;
  findingNoun: string;
  displayToggles: DisplayToggle[];
  isLineWidthShown: boolean;
  isMaskOpacityShown: boolean;
  isGalleryAvailable: boolean;
  isScoreBased: boolean;
  isEmbeddingTuningShown: boolean;
  columns: ColumnDefinition[];
  emptyPictureText: string;
  drawnShapeNoun: string;
  minimumConfidenceHint: string;
  topCountLabel: string;
  comparisonHintOf: (iouThreshold: number) => string;
}

const COMMON_TOGGLES: DisplayToggle[] = [
  { key: "isLabelShown", label: "Labels" },
  { key: "isConfidenceShown", label: "Confidences" },
  { key: "isRejectedShown", label: "Rejected findings" },
  { key: "isComparedShown", label: "Compared model" },
];

const INTERPOLATION_TOGGLE: DisplayToggle = { key: "isInterpolated", label: "Interpolate between sampled frames" };

const FINDING_MINIMUM_HINT = "Findings below it are hidden and not exported.";
const NOTHING_FOUND_TEXT = "Nothing found";
const FOUND_LABEL = "Found";
const pairedComparisonHintOf = (iouThreshold: number): string =>
  `instances paired by IoU ≥ ${iouThreshold}. The compared ones are drawn dotted.`;

const TASK_VIEWS: Record<TaskValue, TaskView> = {
  classification: {
    task: "classification",
    label: "Classification",
    resultTitle: "Predictions",
    findingNoun: "predictions",
    displayToggles: [...COMMON_TOGGLES, { key: "isScorePanelShown", label: "Score panel" }],
    isLineWidthShown: false,
    isMaskOpacityShown: false,
    isGalleryAvailable: true,
    isScoreBased: true,
    isEmbeddingTuningShown: true,
    columns: SCORE_COLUMNS,
    emptyPictureText: "Below the class minimum",
    drawnShapeNoun: "boxes",
    minimumConfidenceHint: "Pictures whose top score is below it get no label and are not exported.",
    topCountLabel: "Top-1",
    comparisonHintOf: () => "matched when both give the same top class.",
  },
  detection: {
    task: "detection",
    label: "Detection",
    resultTitle: "Detections",
    findingNoun: "boxes",
    displayToggles: [...COMMON_TOGGLES, { key: "isFilled", label: "Fill boxes" }, INTERPOLATION_TOGGLE],
    isLineWidthShown: true,
    isMaskOpacityShown: false,
    isGalleryAvailable: false,
    isScoreBased: false,
    isEmbeddingTuningShown: false,
    columns: BOX_FINDING_COLUMNS,
    emptyPictureText: NOTHING_FOUND_TEXT,
    drawnShapeNoun: "boxes",
    minimumConfidenceHint: FINDING_MINIMUM_HINT,
    topCountLabel: FOUND_LABEL,
    comparisonHintOf: pairedComparisonHintOf,
  },
  segmentation: {
    task: "segmentation",
    label: "Segmentation",
    resultTitle: "Instances",
    findingNoun: "instances",
    displayToggles: [
      ...COMMON_TOGGLES,
      { key: "isMaskShown", label: "Masks" },
      { key: "isMaskBoxShown", label: "Boxes around masks" },
      INTERPOLATION_TOGGLE,
    ],
    isLineWidthShown: true,
    isMaskOpacityShown: true,
    isGalleryAvailable: false,
    isScoreBased: false,
    isEmbeddingTuningShown: false,
    columns: MASK_FINDING_COLUMNS,
    emptyPictureText: NOTHING_FOUND_TEXT,
    drawnShapeNoun: "instances",
    minimumConfidenceHint: FINDING_MINIMUM_HINT,
    topCountLabel: FOUND_LABEL,
    comparisonHintOf: pairedComparisonHintOf,
  },
};

export const DEFAULT_TASK: TaskValue = "detection";

export const TASK_ORDER: TaskValue[] = ["classification", "detection", "segmentation"];

export function taskViewOf(task: TaskValue): TaskView {
  return TASK_VIEWS[task];
}
