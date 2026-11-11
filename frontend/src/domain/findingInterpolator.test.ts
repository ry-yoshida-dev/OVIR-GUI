import { describe, expect, it } from "vitest";
import type { Box, Finding, FrameInstance, FramePayload } from "@/api/types";
import { FindingInterpolator } from "@/domain/findingInterpolator";

function instance(index: number, box: Box, overrides: Partial<FrameInstance> = {}): FrameInstance {
  return {
    index,
    class_name: "car",
    matched_prompt: null,
    matched_template: null,
    confidence: 0.9,
    box,
    area: null,
    is_accepted: true,
    is_passing: true,
    polygons: [],
    ...overrides,
  };
}

function frameAt(frame: number, findings: (Finding | FrameInstance)[]): FramePayload {
  return {
    path: "/videos/a.mp4",
    frame,
    task: "segmentation",
    result_frame: frame,
    is_recognized: true,
    is_exact: true,
    outdated: null,
    findings,
    scores: [],
    compared: null,
  };
}

function boxOf(payload: FramePayload, index: number): Box | null {
  return payload.findings.find((finding) => finding.index === index)?.box ?? null;
}

function polygonsOf(payload: FramePayload, index: number): number[][] | null {
  const found = payload.findings.find((finding) => finding.index === index);
  return found !== undefined && "polygons" in found ? found.polygons : null;
}

describe("FindingInterpolator.between", () => {
  it("returns the earlier frame unchanged when the frames do not advance", () => {
    const before = frameAt(10, [instance(0, [0, 0, 10, 10])]);
    const after = frameAt(10, [instance(0, [5, 0, 15, 10])]);
    expect(FindingInterpolator.between(before, after, 10)).toBe(before);
  });

  it("moves a matched box toward its match and marks the frame as not exact", () => {
    const before = frameAt(0, [instance(0, [0, 0, 10, 10])]);
    const after = frameAt(10, [instance(7, [4, 0, 14, 10])]);
    const result = FindingInterpolator.between(before, after, 2);
    expect(result.frame).toBe(2);
    expect(result.is_exact).toBe(false);
    expect(result.findings.map((finding) => finding.index)).toEqual([0]);
    const box = boxOf(result, 0);
    expect(box?.[0]).toBeCloseTo(0.8);
    expect(box?.[2]).toBeCloseTo(10.8);
  });

  it("shows the later frame's findings past the middle while still mixing from the earlier box", () => {
    const before = frameAt(0, [instance(0, [0, 0, 10, 10])]);
    const after = frameAt(10, [instance(7, [4, 0, 14, 10])]);
    const result = FindingInterpolator.between(before, after, 8);
    expect(result.findings.map((finding) => finding.index)).toEqual([7]);
    const box = boxOf(result, 7);
    expect(box?.[0]).toBeCloseTo(3.2);
    expect(box?.[2]).toBeCloseTo(13.2);
  });

  it("keeps the earlier frame's findings exactly at the middle", () => {
    const before = frameAt(0, [instance(0, [0, 0, 10, 10])]);
    const after = frameAt(10, [instance(7, [4, 0, 14, 10])]);
    expect(FindingInterpolator.between(before, after, 5).findings.map((finding) => finding.index)).toEqual([0]);
  });

  it("moves and scales the mask with its box", () => {
    const before = frameAt(0, [instance(0, [0, 0, 10, 10], { polygons: [[2, 4, 10, 10]] })]);
    const after = frameAt(10, [instance(0, [0, 0, 20, 20])]);
    const result = FindingInterpolator.between(before, after, 5);
    expect(boxOf(result, 0)).toEqual([0, 0, 15, 15]);
    expect(polygonsOf(result, 0)).toEqual([[3, 6, 15, 15]]);
  });

  it("keeps an empty mask empty", () => {
    const before = frameAt(0, [instance(0, [0, 0, 10, 10])]);
    const after = frameAt(10, [instance(0, [2, 0, 12, 10])]);
    expect(polygonsOf(FindingInterpolator.between(before, after, 5), 0)).toEqual([]);
  });

  it("moves the mask of a box without width or height without scaling it", () => {
    const before = frameAt(0, [instance(0, [5, 0, 5, 10], { polygons: [[5, 5]] })]);
    const after = frameAt(10, [instance(0, [5, 0, 7, 10])]);
    const result = FindingInterpolator.between(before, after, 5);
    expect(boxOf(result, 0)).toEqual([5, 0, 6, 10]);
    expect(polygonsOf(result, 0)).toEqual([[5, 5]]);
  });

  it("does not match instances of different classes", () => {
    const before = frameAt(0, [instance(0, [0, 0, 10, 10])]);
    const after = frameAt(10, [instance(0, [2, 0, 12, 10], { class_name: "bus" })]);
    expect(boxOf(FindingInterpolator.between(before, after, 5), 0)).toEqual([0, 0, 10, 10]);
  });

  it("does not match instances too far apart", () => {
    const before = frameAt(0, [instance(0, [0, 0, 10, 10])]);
    const after = frameAt(10, [instance(0, [100, 100, 110, 110])]);
    expect(boxOf(FindingInterpolator.between(before, after, 5), 0)).toEqual([0, 0, 10, 10]);
  });

  it("matches nearby instances that do not overlap", () => {
    const before = frameAt(0, [instance(0, [0, 0, 2, 20])]);
    const after = frameAt(10, [instance(0, [3, 0, 5, 20])]);
    expect(boxOf(FindingInterpolator.between(before, after, 5), 0)).toEqual([1.5, 0, 3.5, 20]);
  });

  it("gives each instance on the other frame to the best overlapping instance only", () => {
    const before = frameAt(0, [instance(0, [0, 0, 10, 10]), instance(1, [6, 0, 16, 10])]);
    const after = frameAt(10, [instance(0, [8, 0, 18, 10])]);
    const result = FindingInterpolator.between(before, after, 5);
    expect(boxOf(result, 1)).toEqual([7, 0, 17, 10]);
    expect(boxOf(result, 0)).toEqual([0, 0, 10, 10]);
  });

  it("keeps findings without a box as they are", () => {
    const label: Finding = { ...instance(3, [0, 0, 1, 1]), box: null };
    const before = frameAt(0, [label]);
    const after = frameAt(10, [instance(0, [0, 0, 10, 10])]);
    expect(FindingInterpolator.between(before, after, 2).findings).toEqual([label]);
  });

  it("uses the later box for a frame past the later frame", () => {
    const before = frameAt(0, [instance(0, [0, 0, 10, 10])]);
    const after = frameAt(10, [instance(0, [4, 0, 14, 10])]);
    const result = FindingInterpolator.between(before, after, 20);
    expect(result.frame).toBe(20);
    expect(boxOf(result, 0)).toEqual([4, 0, 14, 10]);
  });
});
