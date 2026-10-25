import type { DrawingKindValue, PicturePrompt } from "../api/types";
import { type ClassColors, classColorOf } from "../lib/frameView";

interface PromptOverlayProps {
  prompt: PicturePrompt;
  scale: number;
  classColors: ClassColors;
  activeObjectId: number | null;
  activeKind: DrawingKindValue;
}

const POSITIVE_COLOR = "#2fbf71";
const NEGATIVE_COLOR = "#e5484d";
const POINT_RADIUS = 6;
const LABEL_FONT_SIZE = 12;
const INACTIVE_KIND_OPACITY = 0.4;

export function PromptOverlay({
  prompt,
  scale,
  classColors,
  activeObjectId,
  activeKind,
}: PromptOverlayProps) {
  const unit = 1 / scale;
  const colorOf = (className: string) => classColorOf(classColors, className);
  const opacityOf = (kind: DrawingKindValue) => (kind === activeKind ? 1 : INACTIVE_KIND_OPACITY);
  return (
    <g style={{ pointerEvents: "none" }}>
      <g opacity={opacityOf("exemplar")}>
      {prompt.exemplars.map((exemplar) => {
          const [left, top, right, bottom] = exemplar.box;
          const stroke = exemplar.is_positive ? POSITIVE_COLOR : NEGATIVE_COLOR;
          return (
            <g key={`exemplar-${exemplar.index}`}>
              <rect
                x={left}
                y={top}
                width={right - left}
                height={bottom - top}
                fill={exemplar.is_positive ? "rgba(47, 191, 113, 0.10)" : "rgba(229, 72, 77, 0.10)"}
                stroke={stroke}
                strokeWidth={2}
                strokeDasharray="8 4"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={left + 4 * unit}
                y={top + (LABEL_FONT_SIZE + 2) * unit}
                fontSize={LABEL_FONT_SIZE * unit}
                fill={stroke}
                fontWeight={700}
              >
                {exemplar.is_positive ? "+" : "−"} {exemplar.class_name}
              </text>
            </g>
          );
        })}
      </g>
      <g opacity={opacityOf("mark")}>
      {prompt.marks.map((mark) => {
          const color = colorOf(mark.class_name);
          const isActive = mark.object_id === activeObjectId;
          const anchor = mark.box ?? [...(mark.positive_points[0] ?? [0, 0]), 0, 0];
          return (
            <g key={`mark-${mark.object_id}`} opacity={isActive || activeObjectId === null ? 1 : 0.7}>
              {mark.box !== null && (
                <rect
                  x={mark.box[0]}
                  y={mark.box[1]}
                  width={mark.box[2] - mark.box[0]}
                  height={mark.box[3] - mark.box[1]}
                  fill="none"
                  stroke={color}
                  strokeWidth={isActive ? 3 : 2}
                  strokeDasharray="10 4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {mark.positive_points.map(([x, y], index) => (
                <circle
                  key={`positive-${index}`}
                  cx={x}
                  cy={y}
                  r={POINT_RADIUS * unit}
                  fill={POSITIVE_COLOR}
                  stroke="#ffffff"
                  strokeWidth={2 * unit}
                />
              ))}
              {mark.negative_points.map(([x, y], index) => (
                <circle
                  key={`negative-${index}`}
                  cx={x}
                  cy={y}
                  r={POINT_RADIUS * unit}
                  fill={NEGATIVE_COLOR}
                  stroke="#ffffff"
                  strokeWidth={2 * unit}
                />
              ))}
              <text
                x={anchor[0] + 8 * unit}
                y={anchor[1] - 6 * unit}
                fontSize={LABEL_FONT_SIZE * unit}
                fill="#ffffff"
                stroke={color}
                strokeWidth={3 * unit}
                paintOrder="stroke"
                fontWeight={700}
              >
                #{mark.object_id} {mark.class_name}
              </text>
            </g>
          );
        })}
      </g>
    </g>
  );
}
