import { describe, expect, it } from "vitest";
import {
  buildPictureGroups,
  type PictureGroup,
  pictureTilePositionOf,
} from "@/domain/pictureGallery";
import { type FindingRow, pictureKeyOf, rowKeyOf, type StatusRow } from "@/domain/resultTable";

const EMPTY_TEXT = "Nothing found";

interface PictureOptions {
  path: string;
  frame?: number | null;
  pictureOrder?: number;
}

function base({ path, frame = null, pictureOrder = 0 }: PictureOptions) {
  return {
    path,
    frame,
    seconds: null,
    mediaName: path.slice(path.lastIndexOf("/") + 1),
    pictureOrder,
    pictureWidth: 640,
    pictureHeight: 480,
    outdated: null,
    scores: [],
  };
}

function findingRow(
  picture: PictureOptions,
  index: number,
  className: string,
  confidence: number,
  options: { isAccepted?: boolean; isPassing?: boolean } = {},
): FindingRow {
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
      box: [0, 0, 10, 10],
      area: 100,
      is_accepted: options.isAccepted ?? true,
      is_passing: options.isPassing ?? true,
    },
  };
}

function statusRow(picture: PictureOptions, text: string): StatusRow {
  return {
    ...base(picture),
    kind: "status",
    key: `${pictureKeyOf(picture.path, picture.frame ?? null)}#status`,
    text,
    isBelowMinimum: false,
  };
}

function tileKeysOf(groups: PictureGroup[]): string[][] {
  return groups.map((group) => group.tiles.map((tile) => tile.key));
}

describe("buildPictureGroups", () => {
  it("returns no groups for no rows", () => {
    expect(buildPictureGroups([], {}, EMPTY_TEXT, "name")).toEqual([]);
  });

  it("shows a picture once under every class it contains", () => {
    const picture = { path: "/a.png" };
    const rows = [
      findingRow(picture, 0, "dog", 0.9),
      findingRow(picture, 1, "cat", 0.8),
      findingRow(picture, 2, "dog", 0.4),
      findingRow(picture, 3, "bird", 0.1, { isPassing: false }),
    ];
    const groups = buildPictureGroups(rows, { cat: "#00ff00", dog: "#ff0000" }, EMPTY_TEXT, "name");
    expect(groups.map((group) => [group.key, group.title, group.className, group.color, group.isStatus])).toEqual([
      ["class:cat", "cat", "cat", "#00ff00", false],
      ["class:dog", "dog", "dog", "#ff0000", false],
    ]);
    expect(tileKeysOf(groups)).toEqual([["/a.png@|class:cat"], ["/a.png@|class:dog"]]);
    const dog = groups[1]?.tiles[0];
    expect(dog?.pictureKey).toBe("/a.png@");
    expect(dog?.pictureRows).toEqual(rows);
    expect(dog?.groupRows.map((row) => row.finding.confidence)).toEqual([0.4, 0.9]);
  });

  it("leads with the least confident kept finding and marks it uncertain below the low score", () => {
    const picture = { path: "/a.png" };
    const rows = [
      findingRow(picture, 0, "dog", 0.9),
      findingRow(picture, 1, "dog", 0.2, { isAccepted: false }),
      findingRow(picture, 2, "dog", 0.45),
    ];
    const tile = buildPictureGroups(rows, {}, EMPTY_TEXT, "name")[0]?.tiles[0];
    expect(tile?.leadRow).toBe(rows[2]);
    expect(tile?.lowestConfidence).toBe(0.45);
    expect(tile?.isUncertain).toBe(true);
    expect(tile?.isRejected).toBe(false);
  });

  it("does not mark a tile uncertain when its kept findings reach the low score", () => {
    const picture = { path: "/a.png" };
    const rows = [findingRow(picture, 0, "dog", 0.2, { isAccepted: false }), findingRow(picture, 1, "dog", 0.5)];
    const tile = buildPictureGroups(rows, {}, EMPTY_TEXT, "name")[0]?.tiles[0];
    expect(tile?.leadRow).toBe(rows[1]);
    expect(tile?.isUncertain).toBe(false);
  });

  it("marks a class with only rejected findings as rejected, led by the least confident", () => {
    const picture = { path: "/a.png" };
    const rows = [
      findingRow(picture, 0, "dog", 0.7, { isAccepted: false }),
      findingRow(picture, 1, "dog", 0.3, { isAccepted: false }),
    ];
    const tile = buildPictureGroups(rows, {}, EMPTY_TEXT, "name")[0]?.tiles[0];
    expect(tile?.leadRow).toBe(rows[1]);
    expect(tile?.lowestConfidence).toBe(0.3);
    expect(tile?.isRejected).toBe(true);
    expect(tile?.isUncertain).toBe(false);
  });

  it("puts a picture with a status row under its status", () => {
    const row = statusRow({ path: "/s.png" }, "Low confidence");
    const groups = buildPictureGroups([row], {}, EMPTY_TEXT, "name");
    expect(groups.map((group) => [group.key, group.title, group.className, group.color, group.isStatus])).toEqual([
      ["status:Low confidence", "Low confidence", null, null, true],
    ]);
    expect(groups[0]?.tiles[0]).toEqual({
      key: "/s.png@|status:Low confidence",
      pictureKey: "/s.png@",
      leadRow: row,
      pictureRows: [],
      groupRows: [],
      lowestConfidence: null,
      isUncertain: false,
      isRejected: false,
    });
  });

  it("puts a picture where nothing reaches the minimum under the empty text", () => {
    const picture = { path: "/f.png" };
    const rows = [
      findingRow(picture, 0, "dog", 0.1, { isPassing: false }),
      findingRow(picture, 1, "cat", 0.05, { isPassing: false }),
    ];
    const groups = buildPictureGroups(rows, {}, EMPTY_TEXT, "name");
    expect(tileKeysOf(groups)).toEqual([[`/f.png@|status:${EMPTY_TEXT}`]]);
    expect(groups[0]?.tiles[0]?.leadRow).toBe(rows[0]);
    expect(groups[0]?.tiles[0]?.pictureRows).toEqual(rows);
  });

  it("puts class groups in class color order, other classes by name, then status groups", () => {
    const rows = [
      statusRow({ path: "/s.png" }, "Low confidence"),
      findingRow({ path: "/1.png" }, 0, "zebra", 0.9),
      findingRow({ path: "/2.png" }, 0, "ant", 0.9),
      findingRow({ path: "/3.png" }, 0, "dog", 0.9),
    ];
    const groups = buildPictureGroups(rows, { dog: "#ff0000" }, EMPTY_TEXT, "name");
    expect(groups.map((group) => group.key)).toEqual(["class:dog", "class:ant", "class:zebra", "status:Low confidence"]);
  });

  it("tells apart frames of one video", () => {
    const rows = [findingRow({ path: "/v.mp4", frame: 7 }, 0, "dog", 0.9), findingRow({ path: "/v.mp4", frame: 2 }, 0, "dog", 0.9)];
    const groups = buildPictureGroups(rows, {}, EMPTY_TEXT, "name");
    expect(tileKeysOf(groups)).toEqual([["/v.mp4@2|class:dog", "/v.mp4@7|class:dog"]]);
  });

  describe("sorting", () => {
    const rows = [
      findingRow({ path: "/img10.png", pictureOrder: 0 }, 0, "dog", 0.6),
      findingRow({ path: "/img2.png", pictureOrder: 1 }, 0, "dog", 0.9),
      findingRow({ path: "/img2.png", pictureOrder: 1 }, 1, "dog", 0.95),
      findingRow({ path: "/img3.png", pictureOrder: 2 }, 0, "dog", 0.6),
    ];

    it("sorts by name naturally", () => {
      expect(tileKeysOf(buildPictureGroups(rows, {}, EMPTY_TEXT, "name"))).toEqual([
        ["/img2.png@|class:dog", "/img3.png@|class:dog", "/img10.png@|class:dog"],
      ]);
    });

    it("sorts least certain first, ties by name", () => {
      expect(tileKeysOf(buildPictureGroups(rows, {}, EMPTY_TEXT, "uncertain"))).toEqual([
        ["/img3.png@|class:dog", "/img10.png@|class:dog", "/img2.png@|class:dog"],
      ]);
    });

    it("sorts by count from the most findings, ties by name", () => {
      expect(tileKeysOf(buildPictureGroups(rows, {}, EMPTY_TEXT, "count"))).toEqual([
        ["/img2.png@|class:dog", "/img3.png@|class:dog", "/img10.png@|class:dog"],
      ]);
    });

    it("sorts status tiles by name whatever the sort", () => {
      const statusRows = [statusRow({ path: "/b.png" }, "Low confidence"), statusRow({ path: "/a.png" }, "Low confidence")];
      expect(tileKeysOf(buildPictureGroups(statusRows, {}, EMPTY_TEXT, "count"))).toEqual([
        ["/a.png@|status:Low confidence", "/b.png@|status:Low confidence"],
      ]);
    });
  });
});

describe("pictureTilePositionOf", () => {
  const picture = { path: "/a.png" };
  const rows = [
    findingRow(picture, 0, "cat", 0.8),
    findingRow(picture, 1, "dog", 0.9),
    findingRow(picture, 2, "dog", 0.6),
    findingRow(picture, 3, "bird", 0.1, { isPassing: false }),
    statusRow({ path: "/s.png" }, "Low confidence"),
  ];
  const groups = buildPictureGroups(rows, { cat: "#000000", dog: "#ffffff" }, EMPTY_TEXT, "name");

  it("finds the tile led by the row", () => {
    expect(pictureTilePositionOf(groups, rowKeyOf("/a.png", null, 2))).toEqual({ groupIndex: 1, tileIndex: 0 });
  });

  it("finds the tile of the row's class when another row leads it", () => {
    expect(pictureTilePositionOf(groups, rowKeyOf("/a.png", null, 1))).toEqual({ groupIndex: 1, tileIndex: 0 });
  });

  it("falls back to the first tile of the picture", () => {
    expect(pictureTilePositionOf(groups, rowKeyOf("/a.png", null, 3))).toEqual({ groupIndex: 0, tileIndex: 0 });
  });

  it("finds the status tile of a status row", () => {
    expect(pictureTilePositionOf(groups, "/s.png@#status")).toEqual({ groupIndex: 2, tileIndex: 0 });
  });

  it("returns null for no row or an unknown picture", () => {
    expect(pictureTilePositionOf(groups, null)).toBeNull();
    expect(pictureTilePositionOf(groups, rowKeyOf("/z.png", null, 0))).toBeNull();
  });
});
