import type { Box, ResultsPayload } from "../api/types";
import { ReviewFilter } from "./reviewFilter";
import { ScoreHistogram } from "./scoreHistogram";

export const MINIMUM_CHARTED_OVERLAP = 0.05;

export class OverlapOverview {
  readonly overall: ScoreHistogram;
  private readonly classHistograms: Map<string, ScoreHistogram>;

  private constructor(
    overall: ScoreHistogram,
    classHistograms: Map<string, ScoreHistogram>,
  ) {
    this.overall = overall;
    this.classHistograms = classHistograms;
  }

  static of(
    payload: ResultsPayload | null,
    reviewFilter: ReviewFilter,
  ): OverlapOverview {
    const allOverlaps: number[] = [];
    const classOverlaps = new Map<string, number[]>();
    for (const picture of payload?.pictures ?? []) {
      const boxesByClass = new Map<string, Box[]>();
      for (const finding of reviewFilter.reaching(picture.findings)) {
        if (finding.box === null) continue;
        const boxes = boxesByClass.get(finding.class_name) ?? [];
        boxes.push(finding.box);
        boxesByClass.set(finding.class_name, boxes);
      }
      for (const [className, boxes] of boxesByClass) {
        for (let first = 0; first < boxes.length; first += 1) {
          for (let second = first + 1; second < boxes.length; second += 1) {
            const firstBox = boxes[first];
            const secondBox = boxes[second];
            if (firstBox === undefined || secondBox === undefined) continue;
            const overlap = ReviewFilter.overlapOf(firstBox, secondBox);
            if (overlap < MINIMUM_CHARTED_OVERLAP) continue;
            allOverlaps.push(overlap);
            const overlaps = classOverlaps.get(className) ?? [];
            overlaps.push(overlap);
            classOverlaps.set(className, overlaps);
          }
        }
      }
    }
    return new OverlapOverview(
      ScoreHistogram.of(allOverlaps),
      new Map(
        [...classOverlaps.entries()].map(([className, overlaps]) => [
          className,
          ScoreHistogram.of(overlaps),
        ]),
      ),
    );
  }

  histogramOf(className: string): ScoreHistogram {
    return this.classHistograms.get(className) ?? ScoreHistogram.of([]);
  }
}
