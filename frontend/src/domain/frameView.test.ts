import { describe, expect, it } from "vitest";
import type { Box, Finding, FrameInstance, FramePayload } from "@/api/types";
import { DEFAULT_DISPLAY_OPTIONS, type DisplayOptions } from "@/domain/displayOptions";
import {
  classColorOf,
  comparedOf,
  FALLBACK_CLASS_COLOR,
  isInstance,
  labelOf,
  visibleInstancesOf,
} from "@/domain/frameView";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    index: 0,
    class_name: "person",
    matched_prompt: null,
    matched_template: null,
    confidence: 0.876,
    box: null,
    area: null,
    is_accepted: true,
    is_passing: true,
    ...overrides,
  };
}

function instance(overrides: Partial<FrameInstance> = {}): FrameInstance {
  const box: Box = [0, 0, 10, 10];
  return { ...finding(), box, polygons: [], ...overrides };
}

function framePayload(overrides: Partial<FramePayload> = {}): FramePayload {
  return {
    path: "/videos/a.mp4",
    frame: 0,
    task: "detection",
    result_frame: 0,
    is_recognized: true,
    is_exact: true,
    outdated: null,
    findings: [],
    scores: [],
    compared: null,
    ...overrides,
  };
}

function options(overrides: Partial<DisplayOptions> = {}): DisplayOptions {
  return { ...DEFAULT_DISPLAY_OPTIONS, ...overrides };
}

describe("classColorOf", () => {
  it("returns the color assigned to the class", () => {
    expect(classColorOf({ person: "#00ff00" }, "person")).toBe("#00ff00");
  });

  it("falls back to the default class color for an unknown class", () => {
    expect(classColorOf({}, "person")).toBe(FALLBACK_CLASS_COLOR);
  });

  it("falls back to the given color for an unknown class", () => {
    expect(classColorOf({}, "person", "#123456")).toBe("#123456");
  });
});

describe("isInstance", () => {
  it("accepts a finding with a box and polygons", () => {
    expect(isInstance(instance())).toBe(true);
  });

  it("rejects a finding without polygons", () => {
    expect(isInstance(finding({ box: [0, 0, 1, 1] }))).toBe(false);
  });

  it("rejects a finding with polygons but no box", () => {
    const boxless: Finding | FrameInstance = { ...finding(), box: null, polygons: [] };
    expect(isInstance(boxless)).toBe(false);
  });
});

describe("labelOf", () => {
  it("shows the class and the confidence with two digits", () => {
    expect(labelOf(finding(), options())).toBe("person 0.88");
  });

  it("omits the confidence when it is hidden", () => {
    expect(labelOf(finding(), options({ isConfidenceShown: false }))).toBe("person");
  });

  it("puts the prefix before the class", () => {
    expect(labelOf(finding(), options(), "base: ")).toBe("base: person 0.88");
  });

  it("has no label when labels are hidden", () => {
    expect(labelOf(finding(), options({ isLabelShown: false }))).toBeUndefined();
  });
});

describe("visibleInstancesOf", () => {
  const accepted = instance({ index: 1 });
  const rejected = instance({ index: 2, is_accepted: false });
  const belowMinimum = instance({ index: 3, is_passing: false });
  const classification = finding({ index: 4 });
  const frame = framePayload({ findings: [accepted, rejected, belowMinimum, classification] });

  it("keeps only instances, with rejected ones when shown and below-minimum ones hidden", () => {
    expect(visibleInstancesOf(frame, null, options())).toEqual([accepted, rejected]);
  });

  it("drops rejected instances when they are hidden", () => {
    expect(visibleInstancesOf(frame, null, options({ isRejectedShown: false }))).toEqual([accepted]);
  });

  it("keeps below-minimum instances when they are dimmed", () => {
    expect(visibleInstancesOf(frame, null, options({ belowMinimum: "dim" }))).toEqual([
      accepted,
      rejected,
      belowMinimum,
    ]);
  });

  it("keeps only the listed instances", () => {
    expect(visibleInstancesOf(frame, new Set([2, 4]), options())).toEqual([rejected]);
  });

  it("shows nothing for an empty list", () => {
    expect(visibleInstancesOf(frame, new Set(), options())).toEqual([]);
  });
});

describe("comparedOf", () => {
  const compared = { model_name: "base", findings: [instance()], top_class: "person" };
  const frame = framePayload({ compared });

  it("returns the compared result when it is shown", () => {
    expect(comparedOf(frame, options())).toBe(compared);
  });

  it("returns nothing when the compared result is hidden", () => {
    expect(comparedOf(frame, options({ isComparedShown: false }))).toBeNull();
  });

  it("returns nothing when the frame has no compared result", () => {
    expect(comparedOf(framePayload(), options())).toBeNull();
  });
});
