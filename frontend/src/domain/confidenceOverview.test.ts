import { describe, expect, it } from "vitest";
import type { Finding, ResultPicture, ResultsPayload } from "@/api/types";
import { ConfidenceOverview } from "@/domain/confidenceOverview";
import { UNIT_RANGE } from "@/domain/scoreHistogram";

function finding(overrides: Partial<Finding>): Finding {
  return {
    index: 0,
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

function payloadOf(...findingsByPicture: Finding[][]): ResultsPayload {
  return {
    profile_key: null,
    task: "classification",
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

describe("ConfidenceOverview.of", () => {
  it("lists every configured class and prompt even without results", () => {
    const overview = ConfidenceOverview.of(null, new Map([["cat", ["tabby cat", "kitten"]], ["dog", []]]));
    expect(overview.measuredCount).toBe(0);
    expect(overview.overallKeptCount).toBe(0);
    expect(overview.classes.map((item) => item.className)).toEqual(["cat", "dog"]);
    expect(overview.classes[0]?.prompts.map((item) => item.prompt)).toEqual(["tabby cat", "kitten"]);
    expect(overview.classes[0]?.keptCount).toBe(0);
    expect(total(overview.overall.counts)).toBe(0);
  });

  it("tallies confidences overall, per class and per matched prompt", () => {
    const overview = ConfidenceOverview.of(
      payloadOf(
        [finding({ class_name: "cat", matched_prompt: "kitten", confidence: 0.92 })],
        [
          finding({ class_name: "cat", matched_prompt: "tabby cat", confidence: 0.12 }),
          finding({ class_name: "dog", confidence: 0.5 }),
        ],
      ),
      new Map([["cat", ["tabby cat", "kitten"]], ["dog", ["puppy"]]]),
    );
    expect(overview.measuredCount).toBe(3);
    expect(overview.overall.range).toEqual(UNIT_RANGE);
    expect(overview.overall.counts[2]).toBe(1);
    expect(overview.overall.counts[10]).toBe(1);
    expect(overview.overall.counts[18]).toBe(1);
    const [cat, dog] = overview.classes;
    expect(total(cat?.histogram.counts ?? [])).toBe(2);
    expect(cat?.prompts.map((item) => total(item.histogram.counts))).toEqual([1, 1]);
    expect(total(dog?.histogram.counts ?? [])).toBe(1);
    expect(dog?.prompts.map((item) => total(item.histogram.counts))).toEqual([0]);
  });

  it("counts a finding as kept only when accepted and passing", () => {
    const overview = ConfidenceOverview.of(
      payloadOf([
        finding({ matched_prompt: "kitten", is_accepted: true, is_passing: true }),
        finding({ matched_prompt: "kitten", is_accepted: false, is_passing: true }),
        finding({ matched_prompt: "kitten", is_accepted: true, is_passing: false }),
      ]),
      new Map([["cat", ["kitten"]]]),
    );
    expect(overview.overallKeptCount).toBe(1);
    expect(overview.classes[0]?.keptCount).toBe(1);
    expect(overview.classes[0]?.prompts[0]?.keptCount).toBe(1);
    expect(overview.measuredCount).toBe(3);
  });

  it("appends classes and prompts that are not configured", () => {
    const overview = ConfidenceOverview.of(
      payloadOf([finding({ class_name: "bird", matched_prompt: "sparrow" }), finding({ class_name: "cat", matched_prompt: "lion" })]),
      new Map([["cat", ["kitten"]]]),
    );
    expect(overview.classes.map((item) => item.className)).toEqual(["cat", "bird"]);
    expect(overview.classes[0]?.prompts.map((item) => item.prompt)).toEqual(["kitten", "lion"]);
    expect(overview.classes[1]?.prompts.map((item) => item.prompt)).toEqual(["sparrow"]);
  });

  it("does not tally a finding without a matched prompt under any prompt", () => {
    const overview = ConfidenceOverview.of(payloadOf([finding({ matched_prompt: null })]), new Map([["cat", ["kitten"]]]));
    expect(overview.classes[0]?.keptCount).toBe(1);
    expect(overview.classes[0]?.prompts.map((item) => item.keptCount)).toEqual([0]);
  });

  it("charts similarities over a range rounded out to steps of 0.05", () => {
    const overview = ConfidenceOverview.of(
      payloadOf([finding({ similarity: 0.12 }), finding({ similarity: 0.31 })]),
      new Map([["cat", []]]),
      "similarity",
    );
    expect(overview.measuredCount).toBe(2);
    expect(overview.overall.range.lower).toBeCloseTo(0.1);
    expect(overview.overall.range.upper).toBeCloseTo(0.35);
    expect(overview.classes[0]?.histogram.range).toEqual(overview.overall.range);
    expect(total(overview.overall.counts)).toBe(2);
  });

  it("widens a similarity range of a single value to one step", () => {
    const overview = ConfidenceOverview.of(payloadOf([finding({ similarity: 0.2 })]), new Map(), "similarity");
    expect(overview.overall.range.lower).toBeCloseTo(0.2);
    expect(overview.overall.range.upper).toBeCloseTo(0.25);
  });

  it("covers negative similarities", () => {
    const overview = ConfidenceOverview.of(
      payloadOf([finding({ similarity: -0.32 }), finding({ similarity: 0.04 })]),
      new Map(),
      "similarity",
    );
    expect(overview.overall.range.lower).toBeCloseTo(-0.35);
    expect(overview.overall.range.upper).toBeCloseTo(0.05);
  });

  it("leaves findings without a similarity out of the similarity chart but counts them as kept", () => {
    const overview = ConfidenceOverview.of(
      payloadOf([finding({ similarity: null }), finding({}), finding({ similarity: 0.3 })]),
      new Map(),
      "similarity",
    );
    expect(overview.measuredCount).toBe(1);
    expect(overview.overallKeptCount).toBe(3);
  });

  it("uses the unit range for similarity when nothing is measured", () => {
    const overview = ConfidenceOverview.of(payloadOf([finding({})]), new Map(), "similarity");
    expect(overview.overall.range).toEqual(UNIT_RANGE);
    expect(overview.measuredCount).toBe(0);
  });
});
