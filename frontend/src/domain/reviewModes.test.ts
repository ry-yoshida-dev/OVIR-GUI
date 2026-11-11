import { describe, expect, it } from "vitest";
import { REVIEW_MODE_ORDER, reviewModeOf, snappedValue } from "@/domain/reviewModes";

describe("reviewModeOf", () => {
  it.each(REVIEW_MODE_ORDER)("returns the mode of %s", (value) => {
    expect(reviewModeOf(value).value).toBe(value);
  });

  it("highlights below the value only for the overlap mode", () => {
    expect(reviewModeOf("confidence").highlight).toBe("at-or-above");
    expect(reviewModeOf("similarity").highlight).toBe("at-or-above");
    expect(reviewModeOf("overlap").highlight).toBe("below");
  });

  it("has a minimum below its maximum in every mode", () => {
    for (const value of REVIEW_MODE_ORDER) {
      const mode = reviewModeOf(value);
      expect(mode.minimum).toBeLessThan(mode.maximum);
    }
  });
});

describe("REVIEW_MODE_ORDER", () => {
  it("lists confidence, similarity and overlap", () => {
    expect(REVIEW_MODE_ORDER).toEqual(["confidence", "similarity", "overlap"]);
  });
});

describe("snappedValue", () => {
  it("rounds to the step of the mode", () => {
    expect(snappedValue(reviewModeOf("confidence"), 0.123)).toBe(0.12);
    expect(snappedValue(reviewModeOf("confidence"), 0.125)).toBe(0.13);
    expect(snappedValue(reviewModeOf("overlap"), 0.53)).toBe(0.55);
    expect(snappedValue(reviewModeOf("overlap"), 0.32)).toBe(0.3);
  });

  it("removes floating point noise from the snapped value", () => {
    expect(snappedValue(reviewModeOf("confidence"), 0.07)).toBe(0.07);
    expect(snappedValue(reviewModeOf("overlap"), 0.15)).toBe(0.15);
  });

  it("limits the value to the range of the mode", () => {
    expect(snappedValue(reviewModeOf("confidence"), -0.3)).toBe(0);
    expect(snappedValue(reviewModeOf("confidence"), 1.4)).toBe(1);
    expect(snappedValue(reviewModeOf("similarity"), -2)).toBe(-1);
    expect(snappedValue(reviewModeOf("similarity"), -0.333)).toBe(-0.33);
    expect(snappedValue(reviewModeOf("overlap"), 0)).toBe(0.05);
    expect(snappedValue(reviewModeOf("overlap"), 1)).toBe(0.95);
  });
});
