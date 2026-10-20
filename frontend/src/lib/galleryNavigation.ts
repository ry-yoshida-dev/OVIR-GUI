import { type GalleryGroup, type GalleryTile, pictureKeyOfRowKey } from "./galleryGroups";

export type GalleryDirection = "left" | "right" | "up" | "down";

export interface GalleryPosition {
  groupIndex: number;
  tileIndex: number;
}

function clampColumns(columns: number | undefined): number {
  return columns === undefined || columns < 1 ? 1 : columns;
}

function findPosition(groups: GalleryGroup[], isMatch: (tile: GalleryTile) => boolean): GalleryPosition | null {
  for (const [groupIndex, group] of groups.entries()) {
    const tileIndex = group.tiles.findIndex(isMatch);
    if (tileIndex >= 0) return { groupIndex, tileIndex };
  }
  return null;
}

export function positionOf(groups: GalleryGroup[], rowKey: string | null): GalleryPosition | null {
  if (rowKey === null) return null;
  const pictureKey = pictureKeyOfRowKey(rowKey);
  return (
    findPosition(groups, (tile) => tile.row.key === rowKey) ??
    findPosition(groups, (tile) => tile.pictureKey === pictureKey)
  );
}

export function firstPosition(groups: GalleryGroup[]): GalleryPosition | null {
  const groupIndex = groups.findIndex((group) => group.tiles.length > 0);
  return groupIndex < 0 ? null : { groupIndex, tileIndex: 0 };
}

function stepHorizontally(groups: GalleryGroup[], position: GalleryPosition, step: number): GalleryPosition {
  let { groupIndex, tileIndex } = position;
  tileIndex += step;
  while (groupIndex >= 0 && groupIndex < groups.length) {
    const count = groups[groupIndex]?.tiles.length ?? 0;
    if (tileIndex >= 0 && tileIndex < count) return { groupIndex, tileIndex };
    if (tileIndex < 0) {
      groupIndex -= 1;
      tileIndex = (groups[groupIndex]?.tiles.length ?? 0) - 1;
    } else {
      groupIndex += 1;
      tileIndex = 0;
    }
  }
  return position;
}

function stepVertically(
  groups: GalleryGroup[],
  columnCounts: number[],
  position: GalleryPosition,
  isDownward: boolean,
): GalleryPosition {
  const group = groups[position.groupIndex];
  if (group === undefined) return position;
  const columns = clampColumns(columnCounts[position.groupIndex]);
  const column = position.tileIndex % columns;
  const target = position.tileIndex + (isDownward ? columns : -columns);
  if (target >= 0 && target < group.tiles.length) return { groupIndex: position.groupIndex, tileIndex: target };
  if (isDownward && Math.floor(position.tileIndex / columns) < Math.floor((group.tiles.length - 1) / columns)) {
    return { groupIndex: position.groupIndex, tileIndex: group.tiles.length - 1 };
  }
  let groupIndex = position.groupIndex + (isDownward ? 1 : -1);
  while (groupIndex >= 0 && groupIndex < groups.length) {
    const count = groups[groupIndex]?.tiles.length ?? 0;
    if (count > 0) {
      const nextColumns = clampColumns(columnCounts[groupIndex]);
      const rowStart = isDownward ? 0 : Math.floor((count - 1) / nextColumns) * nextColumns;
      return { groupIndex, tileIndex: Math.min(rowStart + Math.min(column, nextColumns - 1), count - 1) };
    }
    groupIndex += isDownward ? 1 : -1;
  }
  return position;
}

export function moveInGallery(
  groups: GalleryGroup[],
  columnCounts: number[],
  position: GalleryPosition,
  direction: GalleryDirection,
): GalleryPosition {
  switch (direction) {
    case "left":
      return stepHorizontally(groups, position, -1);
    case "right":
      return stepHorizontally(groups, position, 1);
    case "up":
      return stepVertically(groups, columnCounts, position, false);
    case "down":
      return stepVertically(groups, columnCounts, position, true);
  }
}
