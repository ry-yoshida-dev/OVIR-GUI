import { clamp } from "./numbers";

export class ScoreHistogram {
  static readonly BIN_COUNT = 20;

  readonly counts: number[];

  private constructor(counts: number[]) {
    this.counts = counts;
  }

  static of(scores: readonly number[]): ScoreHistogram {
    const counts = new Array<number>(ScoreHistogram.BIN_COUNT).fill(0);
    for (const score of scores) {
      const bin = Math.floor(
        clamp(score, 0, 1) * ScoreHistogram.BIN_COUNT,
      );
      const index = Math.min(bin, ScoreHistogram.BIN_COUNT - 1);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    return new ScoreHistogram(counts);
  }

  get largestCount(): number {
    return Math.max(0, ...this.counts);
  }

  middleScoreOf(bin: number): number {
    return (bin + 0.5) / ScoreHistogram.BIN_COUNT;
  }
}
