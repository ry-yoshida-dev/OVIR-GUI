import type { Finding, RankedScore } from "../api/types";
import type { ClassColors } from "./frameView";
import {
  type FindingRow,
  pictureKeyOf,
  type StatusRow,
  type TableRow,
} from "./resultTable";

export type GallerySortValue = "uncertain" | "score" | "name";

export const GALLERY_SORT_OPTIONS: {
  value: GallerySortValue;
  label: string;
}[] = [
  { value: "uncertain", label: "Least certain" },
  { value: "score", label: "Score" },
  { value: "name", label: "Name" },
];

export const SMALL_MARGIN = 0.1;
export const LOW_SCORE = 0.5;

export interface GalleryTile {
  row: TableRow;
  pictureKey: string;
  finding: Finding | null;
  scores: RankedScore[];
  runnerUp: RankedScore | null;
  margin: number | null;
  isUncertain: boolean;
}

export interface GalleryGroup {
  key: string;
  title: string;
  color: string | null;
  isStatus: boolean;
  tiles: GalleryTile[];
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function findingTileOf(row: FindingRow): GalleryTile {
  const runnerUp = row.scores[1] ?? null;
  const margin =
    runnerUp === null ? null : row.finding.confidence - runnerUp.score;
  return {
    row,
    pictureKey: pictureKeyOf(row.path, row.frame),
    finding: row.finding,
    scores: row.scores,
    runnerUp,
    margin,
    isUncertain:
      row.finding.confidence < LOW_SCORE ||
      (margin !== null && margin < SMALL_MARGIN),
  };
}

function statusTileOf(row: StatusRow): GalleryTile {
  return {
    row,
    pictureKey: pictureKeyOf(row.path, row.frame),
    finding: null,
    scores: row.scores,
    runnerUp: row.scores[1] ?? null,
    margin: null,
    isUncertain: false,
  };
}

function compareByName(left: GalleryTile, right: GalleryTile): number {
  const compared = collator.compare(left.row.mediaName, right.row.mediaName);
  if (compared !== 0) return compared;
  return (
    (left.row.frame ?? -1) - (right.row.frame ?? -1) ||
    left.row.pictureOrder - right.row.pictureOrder
  );
}

function certaintyOf(tile: GalleryTile): number {
  return tile.margin ?? tile.finding?.confidence ?? Number.POSITIVE_INFINITY;
}

function compareTiles(
  left: GalleryTile,
  right: GalleryTile,
  sort: GallerySortValue,
): number {
  switch (sort) {
    case "uncertain":
      return (
        certaintyOf(left) - certaintyOf(right) || compareByName(left, right)
      );
    case "score":
      return (
        (left.finding?.confidence ?? Number.POSITIVE_INFINITY) -
          (right.finding?.confidence ?? Number.POSITIVE_INFINITY) ||
        compareByName(left, right)
      );
    case "name":
      return compareByName(left, right);
  }
}

export function buildGalleryGroups(
  rows: TableRow[],
  classColors: ClassColors,
  sort: GallerySortValue,
): GalleryGroup[] {
  const classOrder: string[] = Object.keys(classColors);
  const classGroups = new Map<string, GalleryTile[]>();
  const statusGroups = new Map<string, GalleryTile[]>();
  const seenTileKeys = new Set<string>();
  for (const row of rows) {
    if (
      row.kind === "finding" &&
      !row.finding.is_passing &&
      row.finding.class_name !== row.scores[0]?.class_name
    )
      continue;
    if (row.kind === "status" && row.isBelowMinimum) continue;
    const groupKey = row.kind === "finding" ? row.finding.class_name : row.text;
    const tileKey = `${pictureKeyOf(row.path, row.frame)}|${groupKey}`;
    if (seenTileKeys.has(tileKey)) continue;
    seenTileKeys.add(tileKey);
    const target = row.kind === "finding" ? classGroups : statusGroups;
    const tile =
      row.kind === "finding" ? findingTileOf(row) : statusTileOf(row);
    const tiles = target.get(groupKey);
    if (tiles === undefined) target.set(groupKey, [tile]);
    else tiles.push(tile);
  }
  const rankOf = (name: string): number => {
    const rank = classOrder.indexOf(name);
    return rank < 0 ? Number.POSITIVE_INFINITY : rank;
  };
  const classNames = [...classGroups.keys()].sort(
    (left, right) =>
      rankOf(left) - rankOf(right) || collator.compare(left, right),
  );
  const groups: GalleryGroup[] = classNames.map((name) => ({
    key: `class:${name}`,
    title: name,
    color: classColors[name] ?? null,
    isStatus: false,
    tiles: (classGroups.get(name) ?? []).sort((left, right) =>
      compareTiles(left, right, sort),
    ),
  }));
  for (const [text, tiles] of statusGroups) {
    groups.push({
      key: `status:${text}`,
      title: text,
      color: null,
      isStatus: true,
      tiles: tiles.sort(compareByName),
    });
  }
  return groups;
}

export function pictureKeyOfRowKey(rowKey: string): string {
  const separator = rowKey.lastIndexOf("#");
  return separator < 0 ? rowKey : rowKey.slice(0, separator);
}
