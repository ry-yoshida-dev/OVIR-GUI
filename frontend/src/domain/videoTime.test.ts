import { describe, expect, it } from "vitest";
import { formatSeconds, tickSecondsOf } from "@/domain/videoTime";

describe("formatSeconds", () => {
  it.each([
    [0, "0:00.0"],
    [5.4, "0:05.4"],
    [65.4, "1:05.4"],
    [600, "10:00.0"],
  ])("formats %d seconds as %s with one fraction digit by default", (seconds, text) => {
    expect(formatSeconds(seconds)).toBe(text);
  });

  it("shows the requested number of fraction digits", () => {
    expect(formatSeconds(3.5, 2)).toBe("0:03.50");
  });

  it("carries seconds that round up to a full minute into the minutes", () => {
    expect(formatSeconds(59.96)).toBe("1:00.0");
    expect(formatSeconds(119.99)).toBe("2:00.0");
  });

  it("pads whole seconds to two digits without fraction digits", () => {
    expect(formatSeconds(125, 0)).toBe("2:05");
    expect(formatSeconds(59.6, 0)).toBe("1:00");
  });
});

describe("tickSecondsOf", () => {
  it("places ticks on a round step that gives about six ticks", () => {
    expect(tickSecondsOf(60)).toEqual([0, 10, 20, 30, 40, 50, 60]);
  });

  it("picks the next round step above the rough step", () => {
    expect(tickSecondsOf(100)).toEqual([0, 30, 60, 90]);
  });

  it("uses half-second ticks for a very short video", () => {
    expect(tickSecondsOf(2)).toEqual([0, 0.5, 1, 1.5, 2]);
  });

  it("puts a single tick at the start of an empty video", () => {
    expect(tickSecondsOf(0)).toEqual([0]);
  });

  it("returns no ticks for a negative length", () => {
    expect(tickSecondsOf(-1)).toEqual([]);
  });

  it("rounds the step up to whole hours beyond the longest round step", () => {
    expect(tickSecondsOf(6 * 36_000)).toEqual([0, 36_000, 72_000, 108_000, 144_000, 180_000, 216_000]);
  });
});
