import type { ClassColors } from "./frameView";
import { LOW_SCORE, pictureKeyOfRowKey } from "./galleryGroups";
import type { GalleryPosition } from "./galleryNavigation";
import {
  type FindingRow,
  pictureKeyOf,
  type TableRow,
} from "./resultTable";

export type PictureGallerySortValue = "uncertain" | "count" | "name";

export const PICTURE_GALLERY_SORT_OPTIONS: {
  value: PictureGallerySortValue;
  label: string;
}[] = [
  { value: "uncertain", label: "Least certain" },
  { value: "count", label: "Count" },
  { value: "name", label: "Name" },
];

/**
 * One picture under one group: a class it contains, or the status of a picture where nothing was found.
 */
export interface PictureTile {
  key: string;
  pictureKey: string;
  leadRow: TableRow;
  pictureRows: FindingRow[];
  groupRows: FindingRow[];
  lowestConfidence: number | null;
  isUncertain: boolean;
  isRejected: boolean;
}

export interface PictureGroup {
  key: string;
  title: string;
  className: string | null;
  color: string | null;
  isStatus: boolean;
  tiles: PictureTile[];
}

interface PictureEntry {
  pictureKey: string;
  rows: TableRow[];
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function compareByName(left: PictureTile, right: PictureTile): number {
  const compared = collator.compare(
    left.leadRow.mediaName,
    right.leadRow.mediaName,
  );
  if (compared !== 0) return compared;
  return (
    (left.leadRow.frame ?? -1) - (right.leadRow.frame ?? -1) ||
    left.leadRow.pictureOrder - right.leadRow.pictureOrder
  );
}

function compareTiles(
  left: PictureTile,
  right: PictureTile,
  sort: PictureGallerySortValue,
): number {
  switch (sort) {
    case "uncertain":
      return (
        (left.lowestConfidence ?? Number.POSITIVE_INFINITY) -
          (right.lowestConfidence ?? Number.POSITIVE_INFINITY) ||
        compareByName(left, right)
      );
    case "count":
      return (
        right.groupRows.length - left.groupRows.length ||
        compareByName(left, right)
      );
    case "name":
      return compareByName(left, right);
  }
}

function picturesOf(rows: TableRow[]): PictureEntry[] {
  const entries = new Map<string, PictureEntry>();
  for (const row of rows) {
    const pictureKey = pictureKeyOf(row.path, row.frame);
    const entry = entries.get(pictureKey);
    if (entry === undefined) entries.set(pictureKey, { pictureKey, rows: [row] });
    else entry.rows.push(row);
  }
  return [...entries.values()];
}

function classTileOf(
  pictureKey: string,
  className: string,
  pictureRows: FindingRow[],
  groupRows: FindingRow[],
): PictureTile {
  const ordered = [...groupRows].sort(
    (left, right) => left.finding.confidence - right.finding.confidence,
  );
  const kept = ordered.filter((row) => row.finding.is_accepted);
  const lead = kept[0] ?? ordered[0];
  if (lead === undefined) throw new RangeError(`No ${className} in ${pictureKey}`);
  return {
    key: `${pictureKey}|class:${className}`,
    pictureKey,
    leadRow: lead,
    pictureRows,
    groupRows: ordered,
    lowestConfidence: lead.finding.confidence,
    isUncertain: kept.length > 0 && lead.finding.confidence < LOW_SCORE,
    isRejected: kept.length === 0,
  };
}

function statusTileOf(
  pictureKey: string,
  text: string,
  leadRow: TableRow,
  pictureRows: FindingRow[],
): PictureTile {
  return {
    key: `${pictureKey}|status:${text}`,
    pictureKey,
    leadRow,
    pictureRows,
    groupRows: [],
    lowestConfidence: null,
    isUncertain: false,
    isRejected: false,
  };
}

/**
 * Groups the pictures by the classes found on them, a picture appearing once under every class it contains, and
 * puts pictures where nothing reaches the minimum confidence under their status.
 */
export function buildPictureGroups(
  rows: TableRow[],
  classColors: ClassColors,
  emptyText: string,
  sort: PictureGallerySortValue,
): PictureGroup[] {
  const classTiles = new Map<string, PictureTile[]>();
  const statusTiles = new Map<string, PictureTile[]>();
  for (const { pictureKey, rows: pictureRows } of picturesOf(rows)) {
    const findingRows = pictureRows.filter(
      (row): row is FindingRow => row.kind === "finding",
    );
    const passingRows = findingRows.filter((row) => row.finding.is_passing);
    const lead = pictureRows[0];
    if (lead === undefined) continue;
    if (passingRows.length === 0) {
      const text = lead.kind === "status" ? lead.text : emptyText;
      const tile = statusTileOf(pictureKey, text, lead, findingRows);
      const tiles = statusTiles.get(text);
      if (tiles === undefined) statusTiles.set(text, [tile]);
      else tiles.push(tile);
      continue;
    }
    const rowsByClass = new Map<string, FindingRow[]>();
    for (const row of passingRows) {
      const classRows = rowsByClass.get(row.finding.class_name);
      if (classRows === undefined) rowsByClass.set(row.finding.class_name, [row]);
      else classRows.push(row);
    }
    for (const [className, groupRows] of rowsByClass) {
      const tile = classTileOf(pictureKey, className, findingRows, groupRows);
      const tiles = classTiles.get(className);
      if (tiles === undefined) classTiles.set(className, [tile]);
      else tiles.push(tile);
    }
  }
  const classOrder: string[] = Object.keys(classColors);
  const rankOf = (name: string): number => {
    const rank = classOrder.indexOf(name);
    return rank < 0 ? Number.POSITIVE_INFINITY : rank;
  };
  const classNames = [...classTiles.keys()].sort(
    (left, right) =>
      rankOf(left) - rankOf(right) || collator.compare(left, right),
  );
  const groups: PictureGroup[] = classNames.map((name) => ({
    key: `class:${name}`,
    title: name,
    className: name,
    color: classColors[name] ?? null,
    isStatus: false,
    tiles: (classTiles.get(name) ?? []).sort((left, right) =>
      compareTiles(left, right, sort),
    ),
  }));
  for (const [text, tiles] of statusTiles) {
    groups.push({
      key: `status:${text}`,
      title: text,
      className: null,
      color: null,
      isStatus: true,
      tiles: tiles.sort(compareByName),
    });
  }
  return groups;
}

function findTile(
  groups: PictureGroup[],
  isMatch: (tile: PictureTile) => boolean,
): GalleryPosition | null {
  for (const [groupIndex, group] of groups.entries()) {
    const tileIndex = group.tiles.findIndex(isMatch);
    if (tileIndex >= 0) return { groupIndex, tileIndex };
  }
  return null;
}

/**
 * Tile holding the selected row: the one of its class, or the first tile of its picture.
 */
export function pictureTilePositionOf(
  groups: PictureGroup[],
  rowKey: string | null,
): GalleryPosition | null {
  if (rowKey === null) return null;
  const pictureKey = pictureKeyOfRowKey(rowKey);
  return (
    findTile(
      groups,
      (tile) =>
        tile.leadRow.key === rowKey ||
        tile.groupRows.some((row) => row.key === rowKey),
    ) ?? findTile(groups, (tile) => tile.pictureKey === pictureKey)
  );
}
