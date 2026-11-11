import { describe, expect, it } from "vitest";
import type { ClassMatrixPayload } from "@/api/types";
import { diagonalOf, topPairsOf } from "@/domain/classPairs";

const SYMMETRIC: ClassMatrixPayload = {
  class_names: ["cat", "dog", "bird"],
  counts: [
    [9, 4, 1],
    [4, 7, 6],
    [1, 6, 5],
  ],
};

describe("topPairsOf", () => {
  it("lists each pair of a symmetric matrix once, largest first", () => {
    expect(topPairsOf(SYMMETRIC, true, 10)).toEqual([
      { first: "bird", second: "dog", count: 6 },
      { first: "dog", second: "cat", count: 4 },
      { first: "bird", second: "cat", count: 1 },
    ]);
  });

  it("lists both directions of an asymmetric matrix", () => {
    const matrix: ClassMatrixPayload = {
      class_names: ["cat", "dog"],
      counts: [
        [3, 2],
        [5, 1],
      ],
    };
    expect(topPairsOf(matrix, false, 10)).toEqual([
      { first: "dog", second: "cat", count: 5 },
      { first: "cat", second: "dog", count: 2 },
    ]);
  });

  it("never pairs a class with itself", () => {
    const pairs = topPairsOf(SYMMETRIC, false, 10);
    expect(pairs.every((pair) => pair.first !== pair.second)).toBe(true);
  });

  it("keeps at most the limit of pairs", () => {
    expect(topPairsOf(SYMMETRIC, true, 2).map((pair) => pair.count)).toEqual([6, 4]);
    expect(topPairsOf(SYMMETRIC, true, 0)).toEqual([]);
  });

  it("skips pairs with a zero count", () => {
    const matrix: ClassMatrixPayload = {
      class_names: ["cat", "dog"],
      counts: [
        [3, 0],
        [0, 1],
      ],
    };
    expect(topPairsOf(matrix, false, 10)).toEqual([]);
  });

  it("treats missing rows and cells as zero", () => {
    const matrix: ClassMatrixPayload = {
      class_names: ["cat", "dog", "bird"],
      counts: [[0, 2]],
    };
    expect(topPairsOf(matrix, false, 10)).toEqual([{ first: "cat", second: "dog", count: 2 }]);
  });

  it("returns no pairs for an empty matrix", () => {
    expect(topPairsOf({ class_names: [], counts: [] }, true, 5)).toEqual([]);
  });
});

describe("diagonalOf", () => {
  it("reads the diagonal value of a class", () => {
    expect(diagonalOf(SYMMETRIC, "dog")).toBe(7);
  });

  it("returns zero for a class not in the matrix", () => {
    expect(diagonalOf(SYMMETRIC, "fish")).toBe(0);
  });

  it("returns zero when the row is missing", () => {
    expect(diagonalOf({ class_names: ["cat"], counts: [] }, "cat")).toBe(0);
  });
});
