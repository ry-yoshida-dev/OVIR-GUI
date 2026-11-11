import { describe, expect, it } from "vitest";
import type { RankedScore } from "@/api/types";
import {
  buildGalleryGroups,
  type GalleryGroup,
  LOW_SCORE,
  pictureKeyOfRowKey,
  SMALL_MARGIN,
} from "@/domain/galleryGroups";
import { type FindingRow, pictureKeyOf, rowKeyOf, type StatusRow } from "@/domain/resultTable";

interface PictureOptions {
  path: string;
  frame?: number | null;
  pictureOrder?: number;
  scores?: RankedScore[];
}

function base({ path, frame = null, pictureOrder = 0, scores = [] }: PictureOptions) {
  return {
    path,
    frame,
    seconds: null,
    mediaName: path.slice(path.lastIndexOf("/") + 1),
    pictureOrder,
    pictureWidth: 640,
    pictureHeight: 480,
    outdated: null,
    scores,
  };
}

function findingRow(
  picture: PictureOptions,
  className: string,
  confidence: number,
  options: { index?: number; isPassing?: boolean } = {},
): FindingRow {
  const index = options.index ?? 0;
  return {
    ...base(picture),
    kind: "finding",
    key: rowKeyOf(picture.path, picture.frame ?? null, index),
    finding: {
      index,
      class_name: className,
      matched_prompt: className,
      matched_template: null,
      confidence,
      box: null,
      area: null,
      is_accepted: true,
      is_passing: options.isPassing ?? true,
    },
  };
}

function statusRow(picture: PictureOptions, text: string, isBelowMinimum = false): StatusRow {
  return {
    ...base(picture),
    kind: "status",
    key: `${pictureKeyOf(picture.path, picture.frame ?? null)}#status`,
    text,
    isBelowMinimum,
  };
}

function score(className: string, value: number): RankedScore {
  return { class_name: className, score: value, is_reaching_minimum: value >= LOW_SCORE };
}

function tileKeysOf(groups: GalleryGroup[]): string[][] {
  return groups.map((group) => group.tiles.map((tile) => tile.row.key));
}

describe("pictureKeyOfRowKey", () => {
  it("drops the finding index of a row key", () => {
    expect(pictureKeyOfRowKey(rowKeyOf("/a.png", null, 3))).toBe(pictureKeyOf("/a.png", null));
    expect(pictureKeyOfRowKey(rowKeyOf("/v.mp4", 12, 0))).toBe("/v.mp4@12");
  });

  it("drops the status suffix of a status row key", () => {
    expect(pictureKeyOfRowKey("/a.png@#status")).toBe("/a.png@");
  });

  it("splits at the last separator so paths may contain #", () => {
    expect(pictureKeyOfRowKey(rowKeyOf("/x#1/a.png", null, 2))).toBe("/x#1/a.png@");
  });

  it("returns a key without a separator unchanged", () => {
    expect(pictureKeyOfRowKey("/a.png@")).toBe("/a.png@");
    expect(pictureKeyOfRowKey("")).toBe("");
  });
});

describe("buildGalleryGroups", () => {
  it("returns no groups for no rows", () => {
    expect(buildGalleryGroups([], {}, "name")).toEqual([]);
  });

  it("orders class groups by the class colors, then other classes by name, then statuses", () => {
    const rows = [
      statusRow({ path: "/s.png" }, "Low confidence"),
      findingRow({ path: "/1.png" }, "zebra", 0.9),
      findingRow({ path: "/2.png" }, "cat", 0.9),
      findingRow({ path: "/3.png" }, "dog", 0.9),
      findingRow({ path: "/4.png" }, "ant", 0.9),
    ];
    const groups = buildGalleryGroups(rows, { dog: "#ff0000", cat: "#00ff00" }, "name");
    expect(groups.map((group) => [group.key, group.title, group.color, group.isStatus])).toEqual([
      ["class:dog", "dog", "#ff0000", false],
      ["class:cat", "cat", "#00ff00", false],
      ["class:ant", "ant", null, false],
      ["class:zebra", "zebra", null, false],
      ["status:Low confidence", "Low confidence", null, true],
    ]);
  });

  it("leaves out a failing finding unless it is the top class of the picture", () => {
    const top = findingRow({ path: "/a.png", scores: [score("dog", 0.3)] }, "dog", 0.3, { isPassing: false });
    const other = findingRow({ path: "/b.png", scores: [score("cat", 0.4)] }, "dog", 0.2, { isPassing: false });
    const groups = buildGalleryGroups([top, other], {}, "name");
    expect(tileKeysOf(groups)).toEqual([[top.key]]);
  });

  it("leaves out status rows below the minimum", () => {
    const rows = [statusRow({ path: "/a.png" }, "Nothing found", true)];
    expect(buildGalleryGroups(rows, {}, "name")).toEqual([]);
  });

  it("shows a picture once per class", () => {
    const picture = { path: "/a.png" };
    const first = findingRow(picture, "dog", 0.9, { index: 0 });
    const second = findingRow(picture, "dog", 0.8, { index: 1 });
    const cat = findingRow(picture, "cat", 0.7, { index: 2 });
    const groups = buildGalleryGroups([first, second, cat], {}, "name");
    expect(tileKeysOf(groups)).toEqual([[cat.key], [first.key]]);
  });

  it("tells apart frames of one video", () => {
    const rows = [findingRow({ path: "/v.mp4", frame: 0 }, "dog", 0.9), findingRow({ path: "/v.mp4", frame: 5 }, "dog", 0.9)];
    const tiles = buildGalleryGroups(rows, {}, "name")[0]?.tiles ?? [];
    expect(tiles.map((tile) => tile.pictureKey)).toEqual(["/v.mp4@0", "/v.mp4@5"]);
  });

  it("measures the margin to the runner-up and marks close or low scores as uncertain", () => {
    const confident = findingRow({ path: "/a.png", scores: [score("dog", 0.9), score("cat", 0.5)] }, "dog", 0.9);
    const close = findingRow({ path: "/b.png", scores: [score("dog", 0.9), score("cat", 0.85)] }, "dog", 0.9);
    const low = findingRow({ path: "/c.png", scores: [score("dog", 0.4)] }, "dog", 0.4);
    const alone = findingRow({ path: "/d.png", scores: [score("dog", 0.9)] }, "dog", 0.9);
    const tiles = buildGalleryGroups([confident, close, low, alone], {}, "name")[0]?.tiles ?? [];
    expect(tiles.map((tile) => tile.row.key)).toEqual([confident.key, close.key, low.key, alone.key]);
    const [confidentTile, closeTile, lowTile, aloneTile] = tiles;
    expect(confidentTile?.runnerUp?.class_name).toBe("cat");
    expect(confidentTile?.margin).toBeCloseTo(0.4);
    expect(confidentTile?.isUncertain).toBe(false);
    expect(closeTile?.margin).toBeCloseTo(0.05);
    expect(closeTile?.isUncertain).toBe(true);
    expect(lowTile?.margin).toBeNull();
    expect(lowTile?.isUncertain).toBe(true);
    expect(aloneTile?.runnerUp).toBeNull();
    expect(aloneTile?.isUncertain).toBe(false);
  });

  it("treats a confidence at the low score and a margin above the small margin as certain", () => {
    const atLowScore = findingRow({ path: "/a.png" }, "dog", LOW_SCORE);
    const atMargin = findingRow(
      { path: "/b.png", scores: [score("dog", 0.625), score("cat", 0.5)] },
      "dog",
      0.5 + SMALL_MARGIN + 0.025,
    );
    const tiles = buildGalleryGroups([atLowScore, atMargin], {}, "name")[0]?.tiles ?? [];
    expect(tiles.map((tile) => tile.isUncertain)).toEqual([false, false]);
  });

  it("gives status tiles no finding and never marks them uncertain", () => {
    const row = statusRow({ path: "/a.png", scores: [score("dog", 0.3), score("cat", 0.2)] }, "Low confidence");
    const tile = buildGalleryGroups([row], {}, "uncertain")[0]?.tiles[0];
    expect(tile?.finding).toBeNull();
    expect(tile?.runnerUp?.class_name).toBe("cat");
    expect(tile?.margin).toBeNull();
    expect(tile?.isUncertain).toBe(false);
  });

  it("sorts by name naturally, then by frame and picture order", () => {
    const rows = [
      findingRow({ path: "/img10.png", pictureOrder: 0 }, "dog", 0.9),
      findingRow({ path: "/v.mp4", frame: 20, pictureOrder: 1 }, "dog", 0.9),
      findingRow({ path: "/img2.png", pictureOrder: 2 }, "dog", 0.9),
      findingRow({ path: "/v.mp4", frame: 3, pictureOrder: 3 }, "dog", 0.9),
      findingRow({ path: "/other/IMG2.png", pictureOrder: 4 }, "dog", 0.9),
    ];
    const tiles = buildGalleryGroups(rows, {}, "name")[0]?.tiles ?? [];
    expect(tiles.map((tile) => tile.pictureKey)).toEqual([
      "/img2.png@",
      "/other/IMG2.png@",
      "/img10.png@",
      "/v.mp4@3",
      "/v.mp4@20",
    ]);
  });

  it("sorts least certain first by margin, else by confidence", () => {
    const rows = [
      findingRow({ path: "/a.png" }, "dog", 0.6),
      findingRow({ path: "/b.png", scores: [score("dog", 0.9), score("cat", 0.8)] }, "dog", 0.9),
      findingRow({ path: "/c.png" }, "dog", 0.95),
      findingRow({ path: "/d.png", scores: [score("dog", 0.7), score("cat", 0.0)] }, "dog", 0.7),
    ];
    const tiles = buildGalleryGroups(rows, {}, "uncertain")[0]?.tiles ?? [];
    expect(tiles.map((tile) => tile.pictureKey)).toEqual(["/b.png@", "/a.png@", "/d.png@", "/c.png@"]);
  });

  it("sorts by score from the lowest confidence, ties by name", () => {
    const rows = [
      findingRow({ path: "/c.png" }, "dog", 0.7),
      findingRow({ path: "/b.png" }, "dog", 0.9),
      findingRow({ path: "/a.png" }, "dog", 0.7),
    ];
    const tiles = buildGalleryGroups(rows, {}, "score")[0]?.tiles ?? [];
    expect(tiles.map((tile) => tile.pictureKey)).toEqual(["/a.png@", "/c.png@", "/b.png@"]);
  });

  it("sorts status tiles by name whatever the sort", () => {
    const rows = [statusRow({ path: "/b.png" }, "Low confidence"), statusRow({ path: "/a.png" }, "Low confidence")];
    const tiles = buildGalleryGroups(rows, {}, "score")[0]?.tiles ?? [];
    expect(tiles.map((tile) => tile.pictureKey)).toEqual(["/a.png@", "/b.png@"]);
  });
});
