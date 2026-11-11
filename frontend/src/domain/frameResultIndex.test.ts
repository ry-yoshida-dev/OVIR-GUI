import { describe, expect, it } from "vitest";
import type { Box, FrameInstance, FramePayload } from "@/api/types";
import { FrameResultIndex } from "@/domain/frameResultIndex";

const PATH = "/videos/a.mp4";

function instance(box: Box): FrameInstance {
  return {
    index: 0,
    class_name: "car",
    matched_prompt: null,
    matched_template: null,
    confidence: 0.9,
    box,
    area: null,
    is_accepted: true,
    is_passing: true,
    polygons: [],
  };
}

function frameAt(frame: number | null, overrides: Partial<FramePayload> = {}): FramePayload {
  return {
    path: PATH,
    frame,
    task: "detection",
    result_frame: frame,
    is_recognized: true,
    is_exact: true,
    outdated: null,
    findings: [instance([0, 0, 10, 10])],
    scores: [],
    compared: null,
    ...overrides,
  };
}

function indexOf(frames: (number | null)[]): FrameResultIndex {
  return new FrameResultIndex({ path: PATH, frames: frames.map((frame) => frameAt(frame)) });
}

function framesOf(index: FrameResultIndex): (number | null)[] {
  return index.recognizedFrames.map((frame) => frame.frame);
}

describe("FrameResultIndex", () => {
  describe("contents", () => {
    it("is empty without frames", () => {
      const index = indexOf([]);
      expect(index.isEmpty).toBe(true);
      expect(index.lastFrame).toBeNull();
      expect(index.recognizedFrames).toEqual([]);
    });

    it("drops results that are not tied to a frame", () => {
      const index = indexOf([null, 0, 10]);
      expect(framesOf(index)).toEqual([0, 10]);
      expect(index.isEmpty).toBe(false);
      expect(index.lastFrame).toBe(10);
    });
  });

  describe("merged", () => {
    it("adds new frames in frame order and replaces frames already present", () => {
      const index = indexOf([0, 20]);
      const replacement = frameAt(20, { is_exact: false });
      const merged = index.merged({ path: PATH, frames: [frameAt(10), replacement, frameAt(null)] });
      expect(framesOf(merged)).toEqual([0, 10, 20]);
      expect(merged.resultAt(20)).toBe(replacement);
    });

    it("leaves the original index unchanged", () => {
      const index = indexOf([0]);
      index.merged({ path: PATH, frames: [frameAt(10)] });
      expect(framesOf(index)).toEqual([0]);
    });
  });

  describe("mapped", () => {
    it("transforms every frame", () => {
      const mapped = indexOf([0, 10]).mapped((frame) => ({ ...frame, is_exact: false }));
      expect(mapped.recognizedFrames.map((frame) => frame.is_exact)).toEqual([false, false]);
      expect(framesOf(mapped)).toEqual([0, 10]);
    });

    it("maps an empty index to an empty index", () => {
      expect(indexOf([]).mapped((frame) => frame).isEmpty).toBe(true);
    });
  });

  describe("coveredUntil", () => {
    const index = indexOf([0, 10, 20, 30, 50]);

    it("follows consecutive samples from the frame to the end of the run", () => {
      expect(index.coveredUntil(0, 10)).toBe(30);
      expect(index.coveredUntil(5, 10)).toBe(30);
    });

    it("stops at the sample before a gap wider than the step", () => {
      expect(index.coveredUntil(35, 10)).toBe(30);
    });

    it("is not covered when the next sample is a full step away", () => {
      expect(index.coveredUntil(40, 10)).toBeNull();
    });

    it("is not covered past the last sample", () => {
      expect(index.coveredUntil(100, 10)).toBeNull();
    });

    it("is not covered in an empty index", () => {
      expect(indexOf([]).coveredUntil(0, 10)).toBeNull();
    });
  });

  describe("resultAt", () => {
    const index = indexOf([0, 10, 20]);

    it("returns the result recognized at the frame", () => {
      expect(index.resultAt(10)?.frame).toBe(10);
    });

    it("returns nothing between samples", () => {
      expect(index.resultAt(15)).toBeNull();
    });

    it("returns nothing before the first sample", () => {
      expect(index.resultAt(-1)).toBeNull();
    });
  });

  describe("interpolatedAt", () => {
    it("returns the recognized result at a sampled frame", () => {
      const index = indexOf([0, 10]);
      expect(index.interpolatedAt(10)).toBe(index.resultAt(10));
    });

    it("interpolates between neighboring samples", () => {
      const index = new FrameResultIndex({
        path: PATH,
        frames: [frameAt(0), frameAt(10, { findings: [instance([2, 0, 12, 10])] })],
      });
      const result = index.interpolatedAt(5);
      expect(result?.frame).toBe(5);
      expect(result?.is_exact).toBe(false);
      expect(result?.findings[0]?.box).toEqual([1, 0, 11, 10]);
    });

    it("returns nothing before the first or after the last sample", () => {
      const index = indexOf([10, 20]);
      expect(index.interpolatedAt(5)).toBeNull();
      expect(index.interpolatedAt(25)).toBeNull();
    });

    it("returns nothing across a gap wider than the usual sampling gap", () => {
      expect(indexOf([0, 10, 20, 30, 50]).interpolatedAt(40)).toBeNull();
    });

    it("takes the wider gap as usual when gaps are equally common", () => {
      expect(indexOf([0, 10, 30]).interpolatedAt(20)?.frame).toBe(20);
    });

    it("returns nothing next to a frame that was not recognized", () => {
      const index = new FrameResultIndex({
        path: PATH,
        frames: [frameAt(0), frameAt(10, { is_recognized: false })],
      });
      expect(index.interpolatedAt(5)).toBeNull();
    });
  });
});
