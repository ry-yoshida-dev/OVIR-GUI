import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { MediaEntry } from "../api/types";
import { useMaskOutlines } from "../hooks/useMaskOutlines";
import { useNearViewport } from "../hooks/useNearViewport";
import type { DisplayOptions } from "../lib/displayOptions";
import { type ClassColors, classColorOf } from "../lib/frameView";
import { firstPosition, type GalleryDirection, moveInGallery } from "../lib/galleryNavigation";
import { MaskOutlineCache } from "../lib/maskOutlineCache";
import {
  buildPictureGroups,
  PICTURE_GALLERY_SORT_OPTIONS,
  type PictureGallerySortValue,
  type PictureGroup,
  type PictureTile,
  pictureTilePositionOf,
} from "../lib/pictureGallery";
import { type FindingRow, frameText, type TableRow } from "../lib/resultTable";
import type { TaskView } from "../lib/taskViews";
import "./ClassificationGallery.css";
import "./PictureGallery.css";
import { FindingOverlay } from "./FindingOverlay";
import { PictureGalleryInspector } from "./PictureGalleryInspector";

export interface PictureGalleryProps {
  taskView: TaskView;
  rows: TableRow[];
  media: MediaEntry[];
  currentPictureKey: string | null;
  selectedKey: string | null;
  classColors: ClassColors;
  options: DisplayOptions;
  onSelectRow: (row: TableRow) => void;
  onOpenPicture: (path: string, frame: number | null) => void;
  onSetAccepted: (rows: TableRow[], isAccepted: boolean) => void;
}

interface ClassCount {
  className: string;
  count: number;
}

function directionOf(key: string): GalleryDirection | null {
  switch (key) {
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    default:
      return null;
  }
}

function columnCountOf(grid: HTMLElement | undefined): number {
  if (grid === undefined) return 1;
  const template = getComputedStyle(grid).gridTemplateColumns;
  const count = template.split(" ").filter((part) => part.length > 0).length;
  return Math.max(1, count);
}

function classCountsOf(rows: FindingRow[], classColors: ClassColors): ClassCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.finding.is_passing) continue;
    counts.set(row.finding.class_name, (counts.get(row.finding.class_name) ?? 0) + 1);
  }
  const classOrder = Object.keys(classColors);
  const rankOf = (name: string): number => {
    const rank = classOrder.indexOf(name);
    return rank < 0 ? Number.POSITIVE_INFINITY : rank;
  };
  return [...counts.entries()]
    .map(([className, count]) => ({ className, count }))
    .sort((left, right) => rankOf(left.className) - rankOf(right.className));
}

function titleOf(tile: PictureTile, counts: ClassCount[]): string {
  const lines: string[] = [tile.leadRow.path];
  const frame = frameText(tile.leadRow.frame, tile.leadRow.seconds);
  if (frame !== "") lines.push(`Frame ${frame}`);
  if (tile.leadRow.kind === "status") lines.push(tile.leadRow.text);
  if (tile.isRejected) lines.push("Rejected");
  if (tile.lowestConfidence !== null) lines.push(`Lowest confidence: ${tile.lowestConfidence.toFixed(3)}`);
  for (const { className, count } of counts) lines.push(`${className}: ${count}`);
  if (tile.leadRow.outdated !== null) lines.push(`Inferred with other classes: ${tile.leadRow.outdated}`);
  return lines.join("\n");
}

function imageSourceOf(row: TableRow, isVideo: boolean): string {
  return isVideo && row.frame !== null ? api.frameUrl(row.path, row.frame, null) : api.imageUrl(row.path, null);
}

function averageConfidenceOf(group: PictureGroup): number | null {
  const confidences = group.tiles.flatMap((tile) => tile.groupRows.map((row) => row.finding.confidence));
  if (confidences.length === 0) return null;
  return confidences.reduce((total, value) => total + value, 0) / confidences.length;
}

interface PictureTileViewProps {
  tile: PictureTile;
  imageSource: string;
  counts: ClassCount[];
  highlightedKey: string | null;
  isSelected: boolean;
  isCurrent: boolean;
  isMaskTask: boolean;
  options: DisplayOptions;
  classColors: ClassColors;
  outlineCache: MaskOutlineCache;
  onSelect: (row: TableRow) => void;
  onOpen: (path: string, frame: number | null) => void;
  registerElement: (tileKey: string, element: HTMLDivElement | null) => void;
}

function PictureTileView({
  tile,
  imageSource,
  counts,
  highlightedKey,
  isSelected,
  isCurrent,
  isMaskTask,
  options,
  classColors,
  outlineCache,
  onSelect,
  onOpen,
  registerElement,
}: PictureTileViewProps) {
  const element = useRef<HTMLDivElement | null>(null);
  const isWanted = isMaskTask && options.isMaskShown;
  const isNear = useNearViewport(element, isWanted);
  const outlines = useMaskOutlines(outlineCache, tile.pictureRows, isWanted && isNear);
  const { leadRow } = tile;
  const isStatus = tile.groupRows.length === 0;
  const classes = [
    "gallery-tile",
    isSelected ? "selected" : "",
    isCurrent ? "current" : "",
    tile.isRejected ? "rejected" : "",
    tile.isUncertain ? "uncertain" : "",
    isStatus ? "status" : "",
  ]
    .filter((name) => name !== "")
    .join(" ");
  const frame = frameText(leadRow.frame, leadRow.seconds);
  return (
    <div
      ref={(node) => {
        element.current = node;
        registerElement(tile.key, node);
      }}
      className={classes}
      title={titleOf(tile, counts)}
      onClick={() => onSelect(leadRow)}
      onDoubleClick={() => onOpen(leadRow.path, leadRow.frame)}
    >
      <img src={imageSource} alt={leadRow.mediaName} loading="lazy" decoding="async" draggable={false} />
      <FindingOverlay
        width={leadRow.pictureWidth}
        height={leadRow.pictureHeight}
        rows={tile.pictureRows}
        outlines={outlines}
        isMaskTask={isMaskTask}
        options={options}
        classColors={classColors}
        highlightedKey={highlightedKey}
        fit="cover"
      />
      {tile.isRejected && <span className="gallery-tile-badge">Rejected</span>}
      {tile.isUncertain && tile.lowestConfidence !== null && (
        <span className="gallery-tile-badge warning">min {tile.lowestConfidence.toFixed(2)}</span>
      )}
      <div className="gallery-tile-footer">
        <span className="picture-tile-name">
          {leadRow.mediaName}
          {frame !== "" && <span className="gallery-tile-frame"> {frame}</span>}
        </span>
        {counts.length > 0 && (
          <span className="picture-tile-counts">
            {counts.map(({ className, count }) => (
              <span key={className} className="picture-tile-count">
                <span className="gallery-dot small" style={{ background: classColorOf(classColors, className) }} />
                {count}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Gallery of detected or segmented pictures with their boxes and masks drawn, grouped by the classes found on them.
 */
export function PictureGallery({
  taskView,
  rows,
  media,
  currentPictureKey,
  selectedKey,
  classColors,
  options,
  onSelectRow,
  onOpenPicture,
  onSetAccepted,
}: PictureGalleryProps) {
  const [sort, setSort] = useState<PictureGallerySortValue>("uncertain");
  const [outlineCache] = useState(() => new MaskOutlineCache());
  const tileElements = useRef<Map<string, HTMLDivElement>>(new Map());
  const gridElements = useRef<Map<string, HTMLDivElement>>(new Map());
  const isMaskTask = taskView.isMaskOpacityShown;
  const shownRows: TableRow[] = useMemo(
    () => (options.isRejectedShown ? rows : rows.filter((row) => row.kind !== "finding" || row.finding.is_accepted)),
    [rows, options.isRejectedShown],
  );
  const groups: PictureGroup[] = useMemo(
    () => buildPictureGroups(shownRows, classColors, taskView.emptyPictureText, sort),
    [shownRows, classColors, taskView.emptyPictureText, sort],
  );
  const videoPaths: Set<string> = useMemo(
    () => new Set(media.filter((entry) => entry.kind === "video").map((entry) => entry.path)),
    [media],
  );
  const selectedPosition = useMemo(() => pictureTilePositionOf(groups, selectedKey), [groups, selectedKey]);
  const selectedTile: PictureTile | null =
    selectedPosition === null ? null : (groups[selectedPosition.groupIndex]?.tiles[selectedPosition.tileIndex] ?? null);
  const selectedFinding: FindingRow | null =
    selectedTile === null
      ? null
      : (selectedTile.pictureRows.find((row) => row.key === selectedKey) ??
        (selectedTile.leadRow.kind === "finding" ? selectedTile.leadRow : null));
  const pictureCount: number = new Set(groups.flatMap((group) => group.tiles.map((tile) => tile.pictureKey))).size;
  const selectedTileKey: string | null = selectedTile?.key ?? null;
  const sourceOf = (row: TableRow): string => imageSourceOf(row, videoPaths.has(row.path));

  useEffect(() => {
    if (selectedTileKey === null) return;
    tileElements.current.get(selectedTileKey)?.scrollIntoView({ block: "nearest" });
  }, [selectedTileKey]);

  const registerTile = (tileKey: string, element: HTMLDivElement | null) => {
    if (element === null) tileElements.current.delete(tileKey);
    else tileElements.current.set(tileKey, element);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = directionOf(event.key);
    if (direction !== null) {
      event.preventDefault();
      const columnCounts = groups.map((group) => columnCountOf(gridElements.current.get(group.key)));
      const next =
        selectedPosition === null
          ? firstPosition(groups)
          : moveInGallery(groups, columnCounts, selectedPosition, direction);
      const tile = next === null ? undefined : groups[next.groupIndex]?.tiles[next.tileIndex];
      if (tile !== undefined && tile.key !== selectedTileKey) onSelectRow(tile.leadRow);
      return;
    }
    if (event.key === "Enter") {
      if (selectedTile === null) return;
      event.preventDefault();
      onOpenPicture(selectedTile.leadRow.path, selectedTile.leadRow.frame);
    } else if (event.key === " ") {
      event.preventDefault();
      if (selectedFinding !== null) onSetAccepted([selectedFinding], !selectedFinding.finding.is_accepted);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="picture-gallery">
        <div className="gallery-empty">Pictures appear here after they are recognized.</div>
      </div>
    );
  }

  return (
    <div className="picture-gallery">
      <div className="canvas-bar">
        <span className="grow gallery-count">{pictureCount} pictures</span>
        <div className="segmented gallery-sort" role="tablist" aria-label="Sort tiles">
          {PICTURE_GALLERY_SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={option.value === sort}
              className={option.value === sort ? "active" : ""}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="gallery-body">
        <div className="gallery-scroll" tabIndex={0} onKeyDown={handleKeyDown}>
          {groups.map((group) => {
            const average = averageConfidenceOf(group);
            return (
              <section key={group.key} className={group.isStatus ? "gallery-group status" : "gallery-group"}>
                <header className="gallery-group-header">
                  {group.color !== null && <span className="gallery-dot" style={{ background: group.color }} />}
                  <span className="gallery-group-title">{group.title}</span>
                  <span className="gallery-group-count">{group.tiles.length}</span>
                  {options.isConfidenceShown && average !== null && (
                    <span className="gallery-group-average">avg {average.toFixed(3)}</span>
                  )}
                </header>
                <div
                  className="gallery-grid"
                  ref={(element) => {
                    if (element === null) gridElements.current.delete(group.key);
                    else gridElements.current.set(group.key, element);
                  }}
                >
                  {group.tiles.map((tile) => {
                    const isSelected = tile.key === selectedTileKey;
                    return (
                      <PictureTileView
                        key={tile.key}
                        tile={tile}
                        imageSource={sourceOf(tile.leadRow)}
                        counts={classCountsOf(tile.pictureRows, classColors)}
                        highlightedKey={isSelected ? (selectedFinding?.key ?? null) : null}
                        isSelected={isSelected}
                        isCurrent={tile.pictureKey === currentPictureKey}
                        isMaskTask={isMaskTask}
                        options={options}
                        classColors={classColors}
                        outlineCache={outlineCache}
                        onSelect={onSelectRow}
                        onOpen={onOpenPicture}
                        registerElement={registerTile}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <PictureGalleryInspector
          taskView={taskView}
          tile={selectedTile}
          selectedFinding={selectedFinding}
          imageSource={selectedTile === null ? null : sourceOf(selectedTile.leadRow)}
          isMaskTask={isMaskTask}
          options={options}
          classColors={classColors}
          outlineCache={outlineCache}
          onSelectRow={onSelectRow}
          onOpen={onOpenPicture}
          onSetAccepted={(row, isAccepted) => onSetAccepted([row], isAccepted)}
        />
      </div>
    </div>
  );
}
