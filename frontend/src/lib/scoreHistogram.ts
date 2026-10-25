import { clamp } from "./numbers";

export interface ValueRange {
  lower: number;
  upper: number;
}

export const UNIT_RANGE: ValueRange = { lower: 0, upper: 1 };

export class ScoreHistogram {
  static readonly BIN_COUNT = 20;

  readonly counts: number[];
  readonly range: ValueRange;

  private constructor(counts: number[], range: ValueRange) {
    this.counts = counts;
    this.range = range;
  }

  static of(
    scores: readonly number[],
    range: ValueRange = UNIT_RANGE,
  ): ScoreHistogram {
    const counts = new Array<number>(ScoreHistogram.BIN_COUNT).fill(0);
    const span = range.upper - range.lower;
    for (const score of scores) {
      const bin = Math.floor(
        clamp((score - range.lower) / span, 0, 1) * ScoreHistogram.BIN_COUNT,
      );
      const index = Math.min(bin, ScoreHistogram.BIN_COUNT - 1);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    return new ScoreHistogram(counts, range);
  }

  get largestCount(): number {
    return Math.max(0, ...this.counts);
  }

  middleScoreOf(bin: number): number {
    return this.boundOf(bin + 0.5);
  }

  boundOf(position: number): number {
    return (
      this.range.lower +
      ((this.range.upper - this.range.lower) * position) /
        ScoreHistogram.BIN_COUNT
    );
  }
}
