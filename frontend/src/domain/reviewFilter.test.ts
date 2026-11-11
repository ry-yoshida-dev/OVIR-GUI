import { describe, expect, it } from "vitest";
import type {
  DuplicateSuppression,
  Finding,
  FramePayload,
  ResultPicture,
  ResultsPayload,
  Thresholds,
} from "@/api/types";
import { FrameResultIndex } from "@/domain/frameResultIndex";
import { ReviewFilter } from "@/domain/reviewFilter";

function finding(overrides: Partial<Finding> & Pick<Finding, "index">): Finding {
  return {
    class_name: "cat",
    matched_prompt: null,
    matched_template: null,
    confidence: 0.5,
    box: null,
    area: null,
    is_accepted: true,
    is_passing: true,
    ...overrides,
  };
}

function thresholds(overrides: Partial<Thresholds> = {}): Thresholds {
  return { default_minimum: 0.3, class_minimums: {}, prompt_minimums: {}, ...overrides };
}

function suppression(overrides: Partial<DuplicateSuppression> = {}): DuplicateSuppression {
  return { is_enabled: true, overlap_threshold: 0.5, class_overlap_thresholds: {}, ...overrides };
}

function frame(frameIndex: number, findings: Finding[]): FramePayload {
  return {
    path: "clip.mp4",
    frame: frameIndex,
    task: "detection",
    result_frame: frameIndex,
    is_recognized: true,
    is_exact: true,
    outdated: null,
    findings,
    scores: [],
    compared: null,
  };
}

function picture(findings: Finding[]): ResultPicture {
  return {
    path: "a.jpg",
    name: "a.jpg",
    frame: null,
    seconds: null,
    width: 100,
    height: 100,
    outdated: null,
    scores: [],
    findings,
  };
}

describe("ReviewFilter.overlapOf", () => {
  it("is one for identical boxes", () => {
    expect(ReviewFilter.overlapOf([0, 0, 10, 10], [0, 0, 10, 10])).toBe(1);
  });

  it("is the intersection over the union", () => {
    expect(ReviewFilter.overlapOf([0, 0, 2, 2], [1, 0, 3, 2])).toBeCloseTo(1 / 3);
  });

  it("is zero for boxes that only touch or are apart", () => {
    expect(ReviewFilter.overlapOf([0, 0, 1, 1], [1, 0, 2, 1])).toBe(0);
    expect(ReviewFilter.overlapOf([0, 0, 1, 1], [5, 5, 6, 6])).toBe(0);
  });

  it("is the area ratio for a box inside another", () => {
    expect(ReviewFilter.overlapOf([0, 0, 4, 4], [1, 1, 3, 3])).toBe(0.25);
  });
});

describe("ReviewFilter.minimumOf", () => {
  const filter = new ReviewFilter(
    thresholds({
      class_minimums: { cat: 0.4 },
      prompt_minimums: { cat: { "tabby cat": 0.6 } },
    }),
    suppression(),
  );

  it("prefers the minimum of the matched prompt", () => {
    expect(filter.minimumOf("cat", "tabby cat")).toBe(0.6);
  });

  it("falls back to the class minimum", () => {
    expect(filter.minimumOf("cat", "black cat")).toBe(0.4);
    expect(filter.minimumOf("cat")).toBe(0.4);
    expect(filter.minimumOf("cat", null)).toBe(0.4);
  });

  it("falls back to the default minimum", () => {
    expect(filter.minimumOf("dog", "tabby cat")).toBe(0.3);
  });

  it("keeps a prompt minimum of zero", () => {
    const zeroFilter = new ReviewFilter(
      thresholds({ class_minimums: { cat: 0.4 }, prompt_minimums: { cat: { kitten: 0 } } }),
      suppression(),
    );
    expect(zeroFilter.minimumOf("cat", "kitten")).toBe(0);
  });
});

describe("ReviewFilter.overlapThresholdOf", () => {
  it("prefers the class threshold over the common one", () => {
    const filter = new ReviewFilter(thresholds(), suppression({ class_overlap_thresholds: { cat: 0.7 } }));
    expect(filter.overlapThresholdOf("cat")).toBe(0.7);
    expect(filter.overlapThresholdOf("dog")).toBe(0.5);
  });
});

describe("ReviewFilter.isReaching and reaching", () => {
  const filter = new ReviewFilter(thresholds({ class_minimums: { dog: 0.8 } }), suppression());

  it("reaches a minimum that the confidence equals", () => {
    expect(filter.isReaching(finding({ index: 0, confidence: 0.3 }))).toBe(true);
    expect(filter.isReaching(finding({ index: 0, confidence: 0.29 }))).toBe(false);
  });

  it("uses the minimum of the finding's class", () => {
    expect(filter.isReaching(finding({ index: 0, class_name: "dog", confidence: 0.5 }))).toBe(false);
  });

  it("keeps only reaching findings in order", () => {
    const findings = [
      finding({ index: 0, confidence: 0.9 }),
      finding({ index: 1, confidence: 0.1 }),
      finding({ index: 2, confidence: 0.4 }),
    ];
    expect(filter.reaching(findings).map((item) => item.index)).toEqual([0, 2]);
    expect(filter.reaching([])).toEqual([]);
  });
});

describe("ReviewFilter.passingIndices", () => {
  it("passes every reaching finding when suppression is off", () => {
    const filter = new ReviewFilter(thresholds(), suppression({ is_enabled: false }));
    const findings = [
      finding({ index: 0, confidence: 0.9, box: [0, 0, 10, 10] }),
      finding({ index: 1, confidence: 0.8, box: [0, 0, 10, 10] }),
      finding({ index: 2, confidence: 0.1, box: [20, 20, 30, 30] }),
    ];
    expect(filter.passingIndices(findings)).toEqual(new Set([0, 1]));
  });

  it("removes the lower-scored of two overlapping boxes of a class", () => {
    const filter = new ReviewFilter(thresholds(), suppression());
    const findings = [
      finding({ index: 0, confidence: 0.6, box: [0, 0, 10, 10] }),
      finding({ index: 1, confidence: 0.9, box: [1, 0, 11, 10] }),
    ];
    expect(filter.passingIndices(findings)).toEqual(new Set([1]));
  });

  it("keeps overlapping boxes of different classes", () => {
    const filter = new ReviewFilter(thresholds(), suppression());
    const findings = [
      finding({ index: 0, confidence: 0.9, box: [0, 0, 10, 10] }),
      finding({ index: 1, class_name: "dog", confidence: 0.8, box: [0, 0, 10, 10] }),
    ];
    expect(filter.passingIndices(findings)).toEqual(new Set([0, 1]));
  });

  it("keeps a box overlapping exactly as much as the threshold", () => {
    const filter = new ReviewFilter(thresholds(), suppression({ overlap_threshold: 0.25 }));
    const findings = [
      finding({ index: 0, confidence: 0.9, box: [0, 0, 4, 4] }),
      finding({ index: 1, confidence: 0.8, box: [1, 1, 3, 3] }),
    ];
    expect(filter.passingIndices(findings)).toEqual(new Set([0, 1]));
  });

  it("uses the class overlap threshold", () => {
    const filter = new ReviewFilter(thresholds(), suppression({ class_overlap_thresholds: { cat: 0.95 } }));
    const findings = [
      finding({ index: 0, confidence: 0.9, box: [0, 0, 10, 10] }),
      finding({ index: 1, confidence: 0.8, box: [1, 0, 11, 10] }),
    ];
    expect(filter.passingIndices(findings)).toEqual(new Set([0, 1]));
  });

  it("keeps the lower index when confidences tie", () => {
    const filter = new ReviewFilter(thresholds(), suppression());
    const findings = [
      finding({ index: 3, confidence: 0.7, box: [0, 0, 10, 10] }),
      finding({ index: 1, confidence: 0.7, box: [0, 0, 10, 10] }),
    ];
    expect(filter.passingIndices(findings)).toEqual(new Set([1]));
  });

  it("passes findings without a box", () => {
    const filter = new ReviewFilter(thresholds(), suppression());
    const findings = [finding({ index: 0, confidence: 0.9 }), finding({ index: 1, confidence: 0.8 })];
    expect(filter.passingIndices(findings)).toEqual(new Set([0, 1]));
  });

  it("does not let a removed box remove another", () => {
    const filter = new ReviewFilter(thresholds(), suppression());
    const findings = [
      finding({ index: 0, confidence: 0.9, box: [0, 0, 10, 10] }),
      finding({ index: 1, confidence: 0.8, box: [2, 0, 12, 10] }),
      finding({ index: 2, confidence: 0.7, box: [4, 0, 14, 10] }),
    ];
    expect(filter.passingIndices(findings)).toEqual(new Set([0, 2]));
  });

  it("passes nothing for no findings", () => {
    expect(new ReviewFilter(thresholds(), suppression()).passingIndices([])).toEqual(new Set());
  });
});

describe("ReviewFilter.marked", () => {
  const filter = new ReviewFilter(thresholds(), suppression());

  it("updates the passing mark of each finding", () => {
    const findings = [
      finding({ index: 0, confidence: 0.9, is_passing: false }),
      finding({ index: 1, confidence: 0.1, is_passing: true }),
    ];
    expect(filter.marked(findings).map((item) => item.is_passing)).toEqual([true, false]);
  });

  it("keeps the same object when the mark is unchanged", () => {
    const unchanged = finding({ index: 0, confidence: 0.9, is_passing: true });
    const [marked] = filter.marked([unchanged]);
    expect(marked).toBe(unchanged);
  });

  it("marks the findings of a frame", () => {
    const marked = filter.markedFrame(frame(4, [finding({ index: 0, confidence: 0.1 })]));
    expect(marked.frame).toBe(4);
    expect(marked.findings.map((item) => item.is_passing)).toEqual([false]);
  });

  it("marks the findings of every picture of the results", () => {
    const payload: ResultsPayload = {
      profile_key: "profile",
      task: "detection",
      pictures: [picture([finding({ index: 0, confidence: 0.1 })]), picture([finding({ index: 0, confidence: 0.9 })])],
    };
    const marked = filter.markedResults(payload);
    expect(marked.profile_key).toBe("profile");
    expect(marked.pictures.map((item) => item.findings.map((each) => each.is_passing))).toEqual([[false], [true]]);
  });

  it("marks the findings of every frame of a video", () => {
    const index = new FrameResultIndex({
      path: "clip.mp4",
      frames: [frame(0, [finding({ index: 0, confidence: 0.1 })]), frame(5, [finding({ index: 0, confidence: 0.9 })])],
    });
    const marked = filter.markedVideo(index);
    expect(marked.recognizedFrames.map((item) => item.findings.map((each) => each.is_passing))).toEqual([
      [false],
      [true],
    ]);
  });
});
