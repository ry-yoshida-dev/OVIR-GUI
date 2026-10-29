import { BELOW_MINIMUM_OPACITY, type DisplayOptions } from "../lib/displayOptions";
import { type ClassColors, classColorOf } from "../lib/frameView";
import type { MaskOutlines } from "../lib/maskOutlineCache";
import type { FindingRow } from "../lib/resultTable";

export type OverlayFit = "cover" | "contain";

interface FindingOverlayProps {
  width: number;
  height: number;
  rows: FindingRow[];
  outlines: MaskOutlines | null;
  isMaskTask: boolean;
  options: DisplayOptions;
  classColors: ClassColors;
  highlightedKey: string | null;
  fit: OverlayFit;
}

const REJECTED_OPACITY = 0.55;
const FILLED_BOX_OPACITY = 0.18;
const HIGHLIGHT_COLOR = "#ffffff";

function opacityOf(row: FindingRow): number {
  if (!row.finding.is_passing) return BELOW_MINIMUM_OPACITY;
  return row.finding.is_accepted ? 1 : REJECTED_OPACITY;
}

function pathOf(polygons: readonly number[][]): string {
  return polygons
    .map((polygon) => {
      const points: string[] = [];
      for (let index = 0; index + 1 < polygon.length; index += 2) {
        points.push(`${polygon[index]} ${polygon[index + 1]}`);
      }
      return points.length === 0 ? "" : `M${points.join("L")}Z`;
    })
    .join("");
}

/**
 * Boxes and masks of a picture drawn over its thumbnail, scaled with the picture the way the thumbnail is fitted.
 */
export function FindingOverlay({
  width,
  height,
  rows,
  outlines,
  isMaskTask,
  options,
  classColors,
  highlightedKey,
  fit,
}: FindingOverlayProps) {
  const ordered = [
    ...rows.filter((row) => row.key !== highlightedKey),
    ...rows.filter((row) => row.key === highlightedKey),
  ];
  return (
    <svg
      className="finding-overlay"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
      aria-hidden="true"
    >
      {ordered.map((row) => {
        const { finding } = row;
        const color = classColorOf(classColors, finding.class_name);
        const isHighlighted = row.key === highlightedKey;
        const strokeWidth = isHighlighted ? options.lineWidth + 1.5 : options.lineWidth;
        const dash = finding.is_accepted ? undefined : "5 4";
        const outline = outlines?.get(finding.index);
        const isMaskDrawn = isMaskTask && options.isMaskShown && outline !== undefined;
        const isBoxDrawn = finding.box !== null && (!isMaskTask || options.isMaskBoxShown);
        const [left, top, right, bottom] = finding.box ?? [0, 0, 0, 0];
        return (
          <g key={row.key} opacity={opacityOf(row)}>
            {isMaskDrawn && (
              <path
                d={pathOf(outline)}
                fill={color}
                fillOpacity={options.maskOpacity}
                fillRule="evenodd"
                stroke={isHighlighted ? HIGHLIGHT_COLOR : color}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {isBoxDrawn && isHighlighted && (
              <rect
                x={left}
                y={top}
                width={right - left}
                height={bottom - top}
                fill="none"
                stroke={HIGHLIGHT_COLOR}
                strokeWidth={strokeWidth + 2}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {isBoxDrawn && (
              <rect
                x={left}
                y={top}
                width={right - left}
                height={bottom - top}
                fill={color}
                fillOpacity={!isMaskTask && options.isFilled ? FILLED_BOX_OPACITY : 0}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
