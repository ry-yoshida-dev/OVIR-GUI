import { describe, expect, it } from "vitest";
import { LivePace } from "@/domain/livePace";

describe("LivePace", () => {
  it("has no rate before any advance", () => {
    expect(new LivePace().rateFor(30)).toBeNull();
  });

  it("has no rate after a single advance", () => {
    const pace = new LivePace();
    pace.record(10, 0);
    expect(pace.rateFor(30)).toBeNull();
  });

  it("plays slightly slower than recognition advances", () => {
    const pace = new LivePace();
    pace.record(0, 0);
    pace.record(15, 1000);
    expect(pace.rateFor(30)).toBeCloseTo(0.45);
  });

  it("never plays faster than real time", () => {
    const pace = new LivePace();
    pace.record(0, 0);
    pace.record(60, 1000);
    expect(pace.rateFor(30)).toBe(1);
  });

  it("never plays slower than the minimum rate", () => {
    const pace = new LivePace();
    pace.record(0, 0);
    pace.record(1, 1000);
    expect(pace.rateFor(30)).toBe(0.0625);
  });

  it("ignores a frontier that did not advance", () => {
    const pace = new LivePace();
    pace.record(10, 0);
    pace.record(10, 500);
    pace.record(5, 900);
    expect(pace.rateFor(30)).toBeNull();
  });

  it("has no rate when advances share the same time", () => {
    const pace = new LivePace();
    pace.record(0, 100);
    pace.record(10, 100);
    expect(pace.rateFor(30)).toBeNull();
  });

  it("has no rate for a video without a positive frame rate", () => {
    const pace = new LivePace();
    pace.record(0, 0);
    pace.record(15, 1000);
    expect(pace.rateFor(0)).toBeNull();
    expect(pace.rateFor(-30)).toBeNull();
  });

  it("forgets advances older than eight seconds", () => {
    const pace = new LivePace();
    pace.record(0, 0);
    pace.record(10, 2000);
    pace.record(100, 9500);
    expect(pace.rateFor(20)).toBeCloseTo((90 / 7.5 / 20) * 0.9);
  });

  it("keeps an advance exactly eight seconds old", () => {
    const pace = new LivePace();
    pace.record(0, 0);
    pace.record(40, 8000);
    expect(pace.rateFor(10)).toBeCloseTo(0.45);
  });

  it("forgets every advance on reset", () => {
    const pace = new LivePace();
    pace.record(0, 0);
    pace.record(15, 1000);
    pace.reset();
    expect(pace.rateFor(30)).toBeNull();
  });
});
