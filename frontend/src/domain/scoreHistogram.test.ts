import { describe, expect, it } from "vitest";
import { ScoreHistogram, UNIT_RANGE } from "@/domain/scoreHistogram";

describe("ScoreHistogram.of", () => {
  it("has twenty empty bins without scores", () => {
    const histogram = ScoreHistogram.of([]);
    expect(histogram.counts).toEqual(new Array<number>(20).fill(0));
    expect(histogram.range).toEqual(UNIT_RANGE);
  });

  it("counts each score in its bin", () => {
    const histogram = ScoreHistogram.of([0, 0.01, 0.05, 0.52, 0.99]);
    expect(histogram.counts[0]).toBe(2);
    expect(histogram.counts[1]).toBe(1);
    expect(histogram.counts[10]).toBe(1);
    expect(histogram.counts[19]).toBe(1);
  });

  it("puts the upper bound in the last bin", () => {
    expect(ScoreHistogram.of([1]).counts[19]).toBe(1);
  });

  it("puts scores outside the range in the outer bins", () => {
    const histogram = ScoreHistogram.of([-0.5, 1.5]);
    expect(histogram.counts[0]).toBe(1);
    expect(histogram.counts[19]).toBe(1);
  });

  it("bins over a given range", () => {
    const histogram = ScoreHistogram.of([-1, 0, 0.95], { lower: -1, upper: 1 });
    expect(histogram.counts[0]).toBe(1);
    expect(histogram.counts[10]).toBe(1);
    expect(histogram.counts[19]).toBe(1);
  });
});

describe("ScoreHistogram.largestCount", () => {
  it("is the count of the fullest bin", () => {
    expect(ScoreHistogram.of([0.1, 0.11, 0.12, 0.9]).largestCount).toBe(3);
  });

  it("is zero without scores", () => {
    expect(ScoreHistogram.of([]).largestCount).toBe(0);
  });
});

describe("ScoreHistogram.boundOf", () => {
  it("maps a bin position to a score in the unit range", () => {
    const histogram = ScoreHistogram.of([]);
    expect(histogram.boundOf(0)).toBe(0);
    expect(histogram.boundOf(10)).toBe(0.5);
    expect(histogram.boundOf(20)).toBe(1);
  });

  it("maps a bin position to a score in a given range", () => {
    const histogram = ScoreHistogram.of([], { lower: -1, upper: 1 });
    expect(histogram.boundOf(0)).toBe(-1);
    expect(histogram.boundOf(10)).toBe(0);
    expect(histogram.boundOf(20)).toBe(1);
  });
});

describe("ScoreHistogram.middleScoreOf", () => {
  it("is the score at the middle of a bin", () => {
    const histogram = ScoreHistogram.of([]);
    expect(histogram.middleScoreOf(0)).toBeCloseTo(0.025);
    expect(histogram.middleScoreOf(19)).toBeCloseTo(0.975);
  });
});
