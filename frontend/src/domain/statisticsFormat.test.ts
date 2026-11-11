import { describe, expect, it } from "vitest";
import { countedNoun, formatCount, formatScore, formatShare, shareOf } from "@/domain/statisticsFormat";

describe("formatCount", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [9_999, "9,999"],
    [10_000, "10K"],
    [12_900, "12.9K"],
    [4_200_000, "4.2M"],
    [-9_999, "-9,999"],
    [-12_900, "-12.9K"],
  ])("writes %d as %s", (count, text) => {
    expect(formatCount(count)).toBe(text);
  });
});

describe("formatShare", () => {
  it.each([
    [0, "0%"],
    [0.0005, "<0.1%"],
    [0.001, "0.1%"],
    [0.05, "5.0%"],
    [0.0999, "10%"],
    [0.1, "10%"],
    [0.123, "12%"],
    [1, "100%"],
  ])("writes %d as %s", (share, text) => {
    expect(formatShare(share)).toBe(text);
  });

  it("writes a dash for a missing share", () => {
    expect(formatShare(null)).toBe("–");
    expect(formatShare(Number.NaN)).toBe("–");
  });
});

describe("formatScore", () => {
  it("writes two decimals", () => {
    expect(formatScore(0.456)).toBe("0.46");
    expect(formatScore(1)).toBe("1.00");
    expect(formatScore(-0.5)).toBe("-0.50");
  });

  it("writes a dash for a missing score", () => {
    expect(formatScore(null)).toBe("–");
  });
});

describe("shareOf", () => {
  it("divides the part by the whole", () => {
    expect(shareOf(1, 4)).toBe(0.25);
    expect(shareOf(0, 4)).toBe(0);
  });

  it("returns null when the whole is empty", () => {
    expect(shareOf(0, 0)).toBeNull();
    expect(shareOf(3, -1)).toBeNull();
  });
});

describe("countedNoun", () => {
  it("uses the singular for one", () => {
    expect(countedNoun(1, "picture")).toBe("1 picture");
  });

  it("uses the default plural for other counts", () => {
    expect(countedNoun(0, "picture")).toBe("0 pictures");
    expect(countedNoun(2, "picture")).toBe("2 pictures");
  });

  it("uses a given plural", () => {
    expect(countedNoun(3, "box", "boxes")).toBe("3 boxes");
  });

  it("formats the count", () => {
    expect(countedNoun(12_900, "finding")).toBe("12.9K findings");
  });
});
