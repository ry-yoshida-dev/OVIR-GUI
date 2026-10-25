import type { Thresholds } from "../../api/types";

export const REVIEW_COLORS = {
  kept: "var(--review-kept)",
  below: "var(--review-below)",
  rejected: "var(--review-rejected)",
} as const;

export const SIZE_COLORS = {
  small: "var(--size-small)",
  medium: "var(--size-medium)",
  large: "var(--size-large)",
} as const;

export const COMPARISON_COLORS = {
  shown: "var(--family-slot-1)",
  compared: "var(--family-slot-0)",
  matched: "var(--comparison-matched)",
} as const;

export function minimumOf(thresholds: Thresholds, className: string): number {
  return thresholds.class_minimums[className] ?? thresholds.default_minimum;
}
