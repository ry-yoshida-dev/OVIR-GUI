import { describe, expect, it } from "vitest";
import type { RankedScore } from "@/api/types";
import {
  SCORE_BAR_GAP,
  SCORE_BAR_WIDTH,
  SCORE_BARS_MARGIN,
  scoreBarHeightOf,
  scoreBarsWidthOf,
  scoreBarTitleOf,
} from "@/domain/scoreBars";

function rankedScore(score: number, isReachingMinimum = true): RankedScore {
  return { class_name: "cat", score, is_reaching_minimum: isReachingMinimum };
}

describe("scoreBarsWidthOf", () => {
  it("takes no width without classes", () => {
    expect(scoreBarsWidthOf(0)).toBe(0);
  });

  it("takes the margin and one bar for one class", () => {
    expect(scoreBarsWidthOf(1)).toBe(SCORE_BARS_MARGIN + SCORE_BAR_WIDTH);
  });

  it("adds a gap between neighboring bars", () => {
    expect(scoreBarsWidthOf(3)).toBe(SCORE_BARS_MARGIN + 3 * SCORE_BAR_WIDTH + 2 * SCORE_BAR_GAP);
    expect(scoreBarsWidthOf(3)).toBe(24);
  });
});

describe("scoreBarHeightOf", () => {
  it("uses the score as the fraction", () => {
    expect(scoreBarHeightOf(rankedScore(0.4))).toBe(0.4);
  });

  it("limits the fraction to the unit range", () => {
    expect(scoreBarHeightOf(rankedScore(-0.2))).toBe(0);
    expect(scoreBarHeightOf(rankedScore(1.5))).toBe(1);
  });
});

describe("scoreBarTitleOf", () => {
  it("writes the class and the score with three decimals", () => {
    expect(scoreBarTitleOf(rankedScore(0.12345))).toBe("cat  0.123");
  });

  it("marks a score below the minimum", () => {
    expect(scoreBarTitleOf(rankedScore(0.05, false))).toBe("cat  0.050  (below minimum)");
  });
});
