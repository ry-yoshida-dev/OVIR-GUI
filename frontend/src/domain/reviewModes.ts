export type ReviewModeValue = "confidence" | "similarity" | "overlap";

export type HistogramHighlight = "at-or-above" | "below";

export interface ReviewMode {
  value: ReviewModeValue;
  title: string;
  step: number;
  minimum: number;
  maximum: number;
  highlight: HistogramHighlight;
  valueHint: string;
}

const REVIEW_MODES: Record<ReviewModeValue, ReviewMode> = {
  confidence: {
    value: "confidence",
    title: "Confidence",
    step: 0.01,
    minimum: 0,
    maximum: 1,
    highlight: "at-or-above",
    valueHint:
      "Findings with a lower confidence are dimmed or hidden and not exported.",
  },
  similarity: {
    value: "similarity",
    title: "Similarity",
    step: 0.01,
    minimum: -1,
    maximum: 1,
    highlight: "at-or-above",
    valueHint:
      "Cosine similarity of each picture and the best phrase of its top class, before the scores are compared across classes.",
  },
  overlap: {
    value: "overlap",
    title: "NMS",
    step: 0.05,
    minimum: 0.05,
    maximum: 0.95,
    highlight: "below",
    valueHint:
      "Of two boxes of a class overlapping more than this IoU, the lower-scored one is removed.",
  },
};

export const REVIEW_MODE_ORDER: ReviewModeValue[] = [
  "confidence",
  "similarity",
  "overlap",
];

export function reviewModeOf(value: ReviewModeValue): ReviewMode {
  return REVIEW_MODES[value];
}

export function snappedValue(mode: ReviewMode, value: number): number {
  const snapped = Math.round(value / mode.step) * mode.step;
  return Math.min(
    mode.maximum,
    Math.max(mode.minimum, Math.round(snapped * 100) / 100),
  );
}
