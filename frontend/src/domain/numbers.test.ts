import { describe, expect, it } from "vitest";
import { clamp, formattedByteSize } from "@/domain/numbers";

describe("clamp", () => {
  it("keeps a value inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("limits a value to the nearest bound", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it("returns the maximum when the range is empty", () => {
    expect(clamp(5, 10, 0)).toBe(0);
  });
});

describe("formattedByteSize", () => {
  it.each([
    [0, "0 B"],
    [999, "999 B"],
    [1_500, "1.5 KB"],
    [662_000_000, "662 MB"],
    [1_500_000_000, "1.5 GB"],
    [3_000_000_000_000_000, "3000 TB"],
  ])("formats %d bytes as %s", (bytes, text) => {
    expect(formattedByteSize(bytes)).toBe(text);
  });
});
