import { describe, expect, it } from "vitest";
import { withEntry } from "@/domain/records";

describe("withEntry", () => {
  it("adds a new key with its value", () => {
    expect(withEntry({ cat: 0.3 }, "dog", 0.5)).toEqual({ cat: 0.3, dog: 0.5 });
  });

  it("replaces the value of an existing key", () => {
    expect(withEntry({ cat: 0.3, dog: 0.5 }, "cat", 0.7)).toEqual({ cat: 0.7, dog: 0.5 });
  });

  it("removes the key when the value is null", () => {
    expect(withEntry({ cat: 0.3, dog: 0.5 }, "cat", null)).toEqual({ dog: 0.5 });
  });

  it("returns an equal copy when removing a missing key", () => {
    expect(withEntry({ cat: 0.3 }, "dog", null)).toEqual({ cat: 0.3 });
  });

  it("keeps a falsy value other than null", () => {
    expect(withEntry({}, "cat", 0)).toEqual({ cat: 0 });
  });

  it("leaves the original record unchanged", () => {
    const record = { cat: 0.3 };
    const next = withEntry(record, "cat", null);
    expect(record).toEqual({ cat: 0.3 });
    expect(next).not.toBe(record);
  });
});
