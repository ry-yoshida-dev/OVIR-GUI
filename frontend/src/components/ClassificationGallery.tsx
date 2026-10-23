import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { MediaEntry } from "../api/types";
import { type ClassColors, classColorOf } from "../lib/frameView";
import {
  buildGalleryGroups,
  GALLERY_SORT_OPTIONS,
  type GalleryGroup,
  type GallerySortValue,
  type GalleryTile,
} from "../lib/galleryGroups";
import { firstPosition, type GalleryDirection, moveInGallery, positionOf } from "../lib/galleryNavigation";
import { frameText, type TableRow } from "../lib/resultTable";
import "./ClassificationGallery.css";
import { GalleryInspector } from "./GalleryInspector";
import { ScoreSpectrum } from "./ScoreSpectrum";

export interface ClassificationGalleryProps {
  rows: TableRow[];
  media: MediaEntry[];
  currentPictureKey: string | null;
  selectedKey: string | null;
  classColors: ClassColors;
  onSelectRow: (row: TableRow) => void;
  onOpenPicture: (path: string, frame: number | null) => void;
  onSetAccepted: (rows: TableRow[], isAccepted: boolean) => void;
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

function titleOf(tile: GalleryTile): string {
  const lines: string[] = [tile.row.path];
  const frame = frameText(tile.row.frame, tile.row.seconds);
  if (frame !== "") lines.push(`Frame ${frame}`);
  if (tile.finding !== null) {
    if (!tile.finding.is_accepted) lines.push("Rejected");
    if (!tile.finding.is_passing) lines.push("Low confidence: under the Confidence ≥ cut");
  } else if (tile.row.kind === "status") {
    lines.push(tile.row.text);
  }
  if (tile.margin !== null) lines.push(`Lead: ${tile.margin.toFixed(3)}`);
  for (const [rank, score] of tile.scores.entries()) {
    lines.push(`${rank + 1}. ${score.class_name} ${score.score.toFixed(3)}`);
  }
  const unlistedCount = tile.row.classCount - tile.scores.length;
  if (unlistedCount > 0) lines.push(`+${unlistedCount} more classes`);
  if (tile.row.outdated !== null) lines.push(`Inferred with other classes: ${tile.row.outdated}`);
  return lines.join("\n");
}

function imageSourceOf(tile: GalleryTile, isVideo: boolean): string {
  const { row } = tile;
  return isVideo && row.frame !== null ? api.frameUrl(row.path, row.frame, null) : api.imageUrl(row.path, null);
}

function averageConfidenceOf(group: GalleryGroup): number | null {
  const confidences = group.tiles.flatMap((tile) => (tile.finding === null ? [] : [tile.finding.confidence]));
  if (confidences.length === 0) return null;
  return confidences.reduce((total, value) => total + value, 0) / confidences.length;
}

interface GalleryTileViewProps {
  tile: GalleryTile;
  color: string | null;
  imageSource: string;
  isSelected: boolean;
  isCurrent: boolean;
  colorOf: (className: string) => string;
  onSelect: (row: TableRow) => void;
  onOpen: (path: string, frame: number | null) => void;
  registerElement: (rowKey: string, element: HTMLDivElement | null) => void;
}

function GalleryTileView({
  tile,
  color,
  imageSource,
  isSelected,
  isCurrent,
  colorOf,
  onSelect,
  onOpen,
  registerElement,
}: GalleryTileViewProps) {
  const { row, finding } = tile;
  const isRejected = finding !== null && !finding.is_accepted;
  const isBelowMinimum = finding !== null && !finding.is_passing;
  const classes = [
    "gallery-tile",
    isSelected ? "selected" : "",
    isCurrent ? "current" : "",
    isRejected ? "rejected" : "",
    isBelowMinimum ? "below-minimum" : "",
    tile.isUncertain ? "uncertain" : "",
    finding === null ? "status" : "",
  ]
    .filter((name) => name !== "")
    .join(" ");
  const frame = frameText(row.frame, row.seconds);
  return (
    <div
      ref={(element) => registerElement(row.key, element)}
      className={classes}
      title={titleOf(tile)}
      onClick={() => onSelect(row)}
      onDoubleClick={() => onOpen(row.path, row.frame)}
    >
      <img src={imageSource} alt={row.mediaName} loading="lazy" decoding="async" draggable={false} />
      <div className="gallery-tile-name">
        {row.mediaName}
        {frame !== "" && <span className="gallery-tile-frame"> {frame}</span>}
      </div>
      {isRejected && <span className="gallery-tile-badge">Rejected</span>}
      {!isRejected && isBelowMinimum && <span className="gallery-tile-badge">Low confidence</span>}
      {!isRejected && !isBelowMinimum && tile.isUncertain && tile.margin !== null && (
        <span className="gallery-tile-badge warning">Δ {tile.margin.toFixed(2)}</span>
      )}
      <div className="gallery-tile-footer">
        {finding !== null && (
          <span className="gallery-tile-score">
            <span className="gallery-dot small" style={{ background: color ?? colorOf(finding.class_name) }} />
            {finding.confidence.toFixed(3)}
          </span>
        )}
        <ScoreSpectrum scores={tile.scores} colorOf={colorOf} />
      </div>
    </div>
  );
}

export function ClassificationGallery({
  rows,
  media,
  currentPictureKey,
  selectedKey,
  classColors,
  onSelectRow,
  onOpenPicture,
  onSetAccepted,
}: ClassificationGalleryProps) {
  const [sort, setSort] = useState<GallerySortValue>("uncertain");
  const tileElements = useRef<Map<string, HTMLDivElement>>(new Map());
  const gridElements = useRef<Map<string, HTMLDivElement>>(new Map());
  const groups: GalleryGroup[] = useMemo(() => buildGalleryGroups(rows, classColors, sort), [rows, classColors, sort]);
  const videoPaths: Set<string> = useMemo(
    () => new Set(media.filter((entry) => entry.kind === "video").map((entry) => entry.path)),
    [media],
  );
  const selectedPosition = useMemo(() => positionOf(groups, selectedKey), [groups, selectedKey]);
  const selectedTile: GalleryTile | null =
    selectedPosition === null ? null : (groups[selectedPosition.groupIndex]?.tiles[selectedPosition.tileIndex] ?? null);
  const tileCount: number = groups.reduce((total, group) => total + group.tiles.length, 0);

  const selectedTileKey: string | null = selectedTile?.row.key ?? null;
  const colorOf = (className: string): string => classColorOf(classColors, className);
  const sourceOf = (tile: GalleryTile): string => imageSourceOf(tile, videoPaths.has(tile.row.path));

  useEffect(() => {
    if (selectedTileKey === null) return;
    tileElements.current.get(selectedTileKey)?.scrollIntoView({ block: "nearest" });
  }, [selectedTileKey]);

  const registerTile = (rowKey: string, element: HTMLDivElement | null) => {
    if (element === null) tileElements.current.delete(rowKey);
    else tileElements.current.set(rowKey, element);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = directionOf(event.key);
    if (direction !== null) {
      event.preventDefault();
      const position = selectedPosition;
      const columnCounts = groups.map((group) => columnCountOf(gridElements.current.get(group.key)));
      const next = position === null ? firstPosition(groups) : moveInGallery(groups, columnCounts, position, direction);
      const tile = next === null ? undefined : groups[next.groupIndex]?.tiles[next.tileIndex];
      if (tile !== undefined && tile.row.key !== selectedTileKey) onSelectRow(tile.row);
      return;
    }
    if (event.key === "Enter") {
      if (selectedTile === null) return;
      event.preventDefault();
      onOpenPicture(selectedTile.row.path, selectedTile.row.frame);
    } else if (event.key === " ") {
      event.preventDefault();
      if (selectedTile !== null && selectedTile.finding !== null) {
        onSetAccepted([selectedTile.row], !selectedTile.finding.is_accepted);
      }
    }
  };

  if (rows.length === 0) {
    return (
      <div className="classification-gallery">
        <div className="gallery-empty">Pictures appear here after they are classified.</div>
      </div>
    );
  }

  return (
    <div className="classification-gallery">
      <div className="canvas-bar">
        <span className="grow gallery-count">{tileCount} pictures</span>
        <div className="segmented gallery-sort" role="tablist" aria-label="Sort tiles">
          {GALLERY_SORT_OPTIONS.map((option) => (
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
                  {average !== null && <span className="gallery-group-average">avg {average.toFixed(3)}</span>}
                </header>
                <div
                  className="gallery-grid"
                  ref={(element) => {
                    if (element === null) gridElements.current.delete(group.key);
                    else gridElements.current.set(group.key, element);
                  }}
                >
                  {group.tiles.map((tile) => (
                    <GalleryTileView
                      key={tile.row.key}
                      tile={tile}
                      color={group.color}
                      imageSource={sourceOf(tile)}
                      isSelected={tile.row.key === selectedTileKey}
                      isCurrent={tile.pictureKey === currentPictureKey}
                      colorOf={colorOf}
                      onSelect={onSelectRow}
                      onOpen={onOpenPicture}
                      registerElement={registerTile}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <GalleryInspector
          tile={selectedTile}
          imageSource={selectedTile === null ? null : sourceOf(selectedTile)}
          colorOf={colorOf}
          onOpen={onOpenPicture}
          onSetAccepted={(tile, isAccepted) => onSetAccepted([tile.row], isAccepted)}
        />
      </div>
    </div>
  );
}
