import { describe, expect, it } from "vitest";
import { toggledMembership, withMembership } from "@/domain/sets";

describe("withMembership", () => {
  it("adds the value when membership is requested", () => {
    expect(withMembership(["a"], "b", true)).toEqual(new Set(["a", "b"]));
  });

  it("removes the value when membership is not requested", () => {
    expect(withMembership(["a", "b"], "b", false)).toEqual(new Set(["a"]));
  });

  it("keeps the set equal when the value already has the requested membership", () => {
    expect(withMembership(["a"], "a", true)).toEqual(new Set(["a"]));
    expect(withMembership(["a"], "b", false)).toEqual(new Set(["a"]));
  });

  it("accepts an empty iterable", () => {
    expect(withMembership([], 1, true)).toEqual(new Set([1]));
    expect(withMembership([], 1, false)).toEqual(new Set());
  });

  it("returns a new set and leaves the original unchanged", () => {
    const original = new Set(["a"]);
    const next = withMembership(original, "b", true);
    expect(next).not.toBe(original);
    expect(original).toEqual(new Set(["a"]));
  });
});

describe("toggledMembership", () => {
  it("adds an absent value", () => {
    expect(toggledMembership(new Set(["a"]), "b")).toEqual(new Set(["a", "b"]));
  });

  it("removes a present value", () => {
    expect(toggledMembership(new Set(["a", "b"]), "a")).toEqual(new Set(["b"]));
  });

  it("leaves the original set unchanged", () => {
    const original = new Set(["a"]);
    toggledMembership(original, "a");
    expect(original).toEqual(new Set(["a"]));
  });
});
