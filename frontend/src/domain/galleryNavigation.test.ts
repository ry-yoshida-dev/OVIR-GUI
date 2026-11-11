import { describe, expect, it } from "vitest";
import { buildGalleryGroups } from "@/domain/galleryGroups";
import {
  firstPosition,
  type GalleryPosition,
  moveInGallery,
  positionOf,
  type TiledGroup,
} from "@/domain/galleryNavigation";
import { type FindingRow, rowKeyOf } from "@/domain/resultTable";

function findingRow(path: string, className: string, index: number): FindingRow {
  return {
    kind: "finding",
    key: rowKeyOf(path, null, index),
    path,
    frame: null,
    seconds: null,
    mediaName: path,
    pictureOrder: 0,
    pictureWidth: 640,
    pictureHeight: 480,
    outdated: null,
    scores: [],
    finding: {
      index,
      class_name: className,
      matched_prompt: className,
      matched_template: null,
      confidence: 0.9,
      box: null,
      area: null,
      is_accepted: true,
      is_passing: true,
    },
  };
}

function groupsOfSizes(...sizes: number[]): TiledGroup[] {
  return sizes.map((size) => ({ tiles: Array.from({ length: size }, (_, index) => index) }));
}

function at(groupIndex: number, tileIndex: number): GalleryPosition {
  return { groupIndex, tileIndex };
}

describe("positionOf", () => {
  const groups = buildGalleryGroups(
    [findingRow("/a.png", "cat", 0), findingRow("/a.png", "dog", 1), findingRow("/b.png", "dog", 0), findingRow("/a.png", "dog", 2)],
    { cat: "#000000", dog: "#ffffff" },
    "name",
  );

  it("finds the tile of the row", () => {
    expect(positionOf(groups, rowKeyOf("/b.png", null, 0))).toEqual(at(1, 1));
    expect(positionOf(groups, rowKeyOf("/a.png", null, 1))).toEqual(at(1, 0));
  });

  it("falls back to the first tile of the picture for a row without its own tile", () => {
    expect(positionOf(groups, rowKeyOf("/a.png", null, 2))).toEqual(at(0, 0));
  });

  it("returns null for no row or an unknown picture", () => {
    expect(positionOf(groups, null)).toBeNull();
    expect(positionOf(groups, rowKeyOf("/z.png", null, 0))).toBeNull();
    expect(positionOf([], rowKeyOf("/a.png", null, 0))).toBeNull();
  });
});

describe("firstPosition", () => {
  it("returns the first tile of the first group with tiles", () => {
    expect(firstPosition(groupsOfSizes(0, 0, 2))).toEqual(at(2, 0));
    expect(firstPosition(groupsOfSizes(1))).toEqual(at(0, 0));
  });

  it("returns null without tiles", () => {
    expect(firstPosition([])).toBeNull();
    expect(firstPosition(groupsOfSizes(0, 0))).toBeNull();
  });
});

describe("moveInGallery horizontally", () => {
  const groups = groupsOfSizes(3, 0, 5);

  it("steps within a group", () => {
    expect(moveInGallery(groups, [], at(0, 1), "right")).toEqual(at(0, 2));
    expect(moveInGallery(groups, [], at(0, 1), "left")).toEqual(at(0, 0));
  });

  it("crosses into the next or previous group, skipping empty ones", () => {
    expect(moveInGallery(groups, [], at(0, 2), "right")).toEqual(at(2, 0));
    expect(moveInGallery(groups, [], at(2, 0), "left")).toEqual(at(0, 2));
  });

  it("stays at either end of the gallery", () => {
    expect(moveInGallery(groups, [], at(0, 0), "left")).toEqual(at(0, 0));
    expect(moveInGallery(groups, [], at(2, 4), "right")).toEqual(at(2, 4));
  });
});

describe("moveInGallery vertically", () => {
  it("moves a row down and up within a group", () => {
    const groups = groupsOfSizes(6);
    expect(moveInGallery(groups, [3], at(0, 1), "down")).toEqual(at(0, 4));
    expect(moveInGallery(groups, [3], at(0, 4), "up")).toEqual(at(0, 1));
  });

  it("moves down to the last tile when the row below is shorter", () => {
    expect(moveInGallery(groupsOfSizes(4), [3], at(0, 2), "down")).toEqual(at(0, 3));
  });

  it("moves down into the first row of the next group, keeping the column", () => {
    expect(moveInGallery(groupsOfSizes(4, 5), [3, 3], at(0, 3), "down")).toEqual(at(1, 0));
    expect(moveInGallery(groupsOfSizes(3, 5), [3, 3], at(0, 2), "down")).toEqual(at(1, 2));
  });

  it("limits the column to the next group's columns and tiles", () => {
    expect(moveInGallery(groupsOfSizes(3, 5), [3, 2], at(0, 2), "down")).toEqual(at(1, 1));
    expect(moveInGallery(groupsOfSizes(3, 1), [3, 3], at(0, 2), "down")).toEqual(at(1, 0));
  });

  it("moves up into the last row of the previous group, skipping empty ones", () => {
    expect(moveInGallery(groupsOfSizes(5, 0, 3), [2, 2, 2], at(2, 1), "up")).toEqual(at(0, 4));
    expect(moveInGallery(groupsOfSizes(4, 0, 3), [2, 2, 2], at(2, 1), "up")).toEqual(at(0, 3));
  });

  it("stays at the top and bottom of the gallery", () => {
    const groups = groupsOfSizes(4, 0);
    expect(moveInGallery(groups, [2, 2], at(0, 1), "up")).toEqual(at(0, 1));
    expect(moveInGallery(groups, [2, 2], at(0, 3), "down")).toEqual(at(0, 3));
  });

  it("treats a missing or non-positive column count as one column", () => {
    expect(moveInGallery(groupsOfSizes(3), [], at(0, 0), "down")).toEqual(at(0, 1));
    expect(moveInGallery(groupsOfSizes(3), [0], at(0, 2), "up")).toEqual(at(0, 1));
  });

  it("stays at a position outside the gallery", () => {
    expect(moveInGallery(groupsOfSizes(2), [2], at(5, 0), "down")).toEqual(at(5, 0));
  });
});
