import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { ClassDrawing } from "@/api/types";
import { NEGATIVE_COLOR, POSITIVE_COLOR } from "@/features/picture-prompts/PromptOverlay";

interface DrawingRowProps {
  drawing: ClassDrawing;
  color: string;
  isSelected: boolean;
  isUsed: boolean;
  onSelect: () => void;
}

const THUMB_WIDTH = 34;
const THUMB_HEIGHT = 26;
const POINT_RADIUS = 2.4;
const STROKE_WIDTH = 1.4;

function countedOf(count: number, noun: string, plural: string): string {
  return `${count} ${count === 1 ? noun : plural}`;
}

/**
 * Counts of what the drawing holds, e.g. "3 points" or "2 points · 1 box".
 */
export function contentTextOf(drawing: ClassDrawing): string {
  if (drawing.kind === "exemplar") return countedOf(drawing.boxes.length, "box", "boxes");
  const pointCount = drawing.positive_points.length + drawing.negative_points.length;
  return [
    pointCount > 0 ? countedOf(pointCount, "point", "points") : "",
    drawing.box !== null ? "1 box" : "",
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

function pictureUrlOf(drawing: ClassDrawing): string {
  return drawing.frame === null ? api.imageUrl(drawing.path, null) : api.frameUrl(drawing.path, drawing.frame, null);
}

function useNaturalSize(url: string): { width: number; height: number } | null {
  const [size, setSize] = useState<{ url: string; width: number; height: number } | null>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setSize({ url, width: image.naturalWidth, height: image.naturalHeight });
    image.src = url;
    return () => {
      image.onload = null;
    };
  }, [url]);
  return size !== null && size.url === url ? size : null;
}

function DrawingThumb({ drawing, color }: { drawing: ClassDrawing; color: string }) {
  const url = pictureUrlOf(drawing);
  const size = useNaturalSize(url);
  if (size === null) return <span className="thumb" />;
  const unit = 1 / Math.max(THUMB_WIDTH / size.width, THUMB_HEIGHT / size.height);
  const boxOf = ([left, top, right, bottom]: [number, number, number, number], stroke: string, key: string) => (
    <rect
      key={key}
      x={left}
      y={top}
      width={right - left}
      height={bottom - top}
      fill="none"
      stroke={stroke}
      strokeWidth={STROKE_WIDTH * unit}
    />
  );
  const pointOf = ([x, y]: [number, number], fill: string, key: string) => (
    <circle key={key} cx={x} cy={y} r={POINT_RADIUS * unit} fill={fill} stroke="#ffffff" strokeWidth={0.8 * unit} />
  );
  return (
    <svg className="thumb" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="xMidYMid slice">
      <image href={url} width={size.width} height={size.height} />
      {drawing.kind === "exemplar" ? (
        drawing.boxes.map((entry) =>
          boxOf(entry.box, entry.is_positive ? POSITIVE_COLOR : NEGATIVE_COLOR, `box-${entry.index}`),
        )
      ) : (
        <>
          {drawing.box !== null && boxOf(drawing.box, color, "box")}
          {drawing.positive_points.map((point, index) => pointOf(point, POSITIVE_COLOR, `positive-${index}`))}
          {drawing.negative_points.map((point, index) => pointOf(point, NEGATIVE_COLOR, `negative-${index}`))}
        </>
      )}
    </svg>
  );
}

/**
 * Row of a point, box or exemplar prompt drawn on one picture, named after the picture.
 */
export function DrawingRow({ drawing, color, isSelected, isUsed, onSelect }: DrawingRowProps) {
  const content = contentTextOf(drawing);
  const unusedTitle =
    drawing.kind === "exemplar"
      ? "The selected model does not take exemplar prompts"
      : drawing.box === null
        ? "The selected model does not take point prompts"
        : "The selected model does not take box prompts";
  return (
    <div
      className={["tree-row child", isSelected ? "selected" : "", isUsed ? "" : "unused"].join(" ")}
      title={isUsed ? `${content} on ${drawing.label}; click to show it` : unusedTitle}
      onClick={onSelect}
    >
      <DrawingThumb drawing={drawing} color={color} />
      <span className="label">{drawing.label}</span>
      {!isUsed && <span className="unused-tag">unused</span>}
      <span className="faint small">{content}</span>
    </div>
  );
}
