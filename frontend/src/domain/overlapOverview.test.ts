import { describe, expect, it } from "vitest";
import type { Box, Finding, ResultPicture, ResultsPayload } from "@/api/types";
import { MINIMUM_CHARTED_OVERLAP, OverlapOverview } from "@/domain/overlapOverview";
import { ReviewFilter } from "@/domain/reviewFilter";

const FILTER = new ReviewFilter(
  { default_minimum: 0.3, class_minimums: {}, prompt_minimums: {} },
  { is_enabled: true, overlap_threshold: 0.5, class_overlap_thresholds: {} },
);

function boxFinding(index: number, className: string, box: Box | null, confidence = 0.9): Finding {
  return {
    index,
    class_name: className,
    matched_prompt: null,
    matched_template: null,
    confidence,
    box,
    area: null,
    is_accepted: true,
    is_passing: true,
  };
}

function payloadOf(...findingsByPicture: Finding[][]): ResultsPayload {
  return {
    profile_key: null,
    task: "detection",
    pictures: findingsByPicture.map(
      (findings, order): ResultPicture => ({
        path: `${order}.jpg`,
        name: `${order}.jpg`,
        frame: null,
        seconds: null,
        width: 100,
        height: 100,
        outdated: null,
        scores: [],
        findings,
      }),
    ),
  };
}

function total(counts: readonly number[]): number {
  return counts.reduce((sum, count) => sum + count, 0);
}

describe("OverlapOverview.of", () => {
  it("is empty without results", () => {
    const overview = OverlapOverview.of(null, FILTER);
    expect(total(overview.overall.counts)).toBe(0);
  });

  it("charts the overlap of each pair of boxes of a class in a picture", () => {
    const overview = OverlapOverview.of(
      payloadOf([
        boxFinding(0, "cat", [0, 0, 4, 4]),
        boxFinding(1, "cat", [1, 1, 3, 3]),
        boxFinding(2, "cat", [0, 0, 4, 4]),
      ]),
      FILTER,
    );
    expect(total(overview.overall.counts)).toBe(3);
    expect(overview.overall.counts[5]).toBe(2);
    expect(overview.overall.counts[19]).toBe(1);
  });

  it("does not pair boxes of different classes or pictures", () => {
    const overview = OverlapOverview.of(
      payloadOf([boxFinding(0, "cat", [0, 0, 4, 4]), boxFinding(1, "dog", [0, 0, 4, 4])], [boxFinding(0, "cat", [0, 0, 4, 4])]),
      FILTER,
    );
    expect(total(overview.overall.counts)).toBe(0);
  });

  it("skips overlaps below the charted minimum", () => {
    const overview = OverlapOverview.of(
      payloadOf([boxFinding(0, "cat", [0, 0, 10, 10]), boxFinding(1, "cat", [9, 9, 19, 19])]),
      FILTER,
    );
    expect(MINIMUM_CHARTED_OVERLAP).toBe(0.05);
    expect(total(overview.overall.counts)).toBe(0);
  });

  it("skips findings below the minimum and findings without a box", () => {
    const overview = OverlapOverview.of(
      payloadOf([
        boxFinding(0, "cat", [0, 0, 4, 4]),
        boxFinding(1, "cat", [0, 0, 4, 4], 0.1),
        boxFinding(2, "cat", null),
      ]),
      FILTER,
    );
    expect(total(overview.overall.counts)).toBe(0);
  });

  it("charts duplicates that suppression removes", () => {
    const overview = OverlapOverview.of(
      payloadOf([boxFinding(0, "cat", [0, 0, 4, 4], 0.9), boxFinding(1, "cat", [0, 0, 4, 4], 0.8)]),
      FILTER,
    );
    expect(total(overview.overall.counts)).toBe(1);
  });
});

describe("OverlapOverview.histogramOf", () => {
  const overview = OverlapOverview.of(
    payloadOf([
      boxFinding(0, "cat", [0, 0, 4, 4]),
      boxFinding(1, "cat", [0, 0, 4, 4]),
      boxFinding(2, "dog", [0, 0, 4, 4]),
      boxFinding(3, "dog", [1, 1, 3, 3]),
    ]),
    FILTER,
  );

  it("charts each class on its own", () => {
    expect(overview.histogramOf("cat").counts[19]).toBe(1);
    expect(total(overview.histogramOf("cat").counts)).toBe(1);
    expect(overview.histogramOf("dog").counts[5]).toBe(1);
    expect(total(overview.overall.counts)).toBe(2);
  });

  it("is empty for a class without overlaps", () => {
    expect(total(overview.histogramOf("bird").counts)).toBe(0);
  });
});
