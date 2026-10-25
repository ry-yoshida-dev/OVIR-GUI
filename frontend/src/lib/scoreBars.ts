import type { RankedScore } from "../api/types";
import { clamp } from "./numbers";

export const SCORE_BAR_WIDTH = 4;
export const SCORE_BAR_GAP = 2;
export const SCORE_BARS_MARGIN = 8;

/**
 * Width taken by the score bars of a picture, including the margin before them.
 */
export function scoreBarsWidthOf(classCount: number): number {
  if (classCount === 0) return 0;
  return SCORE_BARS_MARGIN + classCount * SCORE_BAR_WIDTH + (classCount - 1) * SCORE_BAR_GAP;
}

/**
 * Height of a class's bar as a fraction of the full bar.
 */
export function scoreBarHeightOf(score: RankedScore): number {
  return clamp(score.score, 0, 1);
}

export function scoreBarTitleOf(score: RankedScore): string {
  const text = `${score.class_name}  ${score.score.toFixed(3)}`;
  return score.is_reaching_minimum ? text : `${text}  (below minimum)`;
}
