import type { PointerEvent } from "react";
import type { Box, MarkEntry, PicturePrompt } from "@/api/types";
import { isSameItem, type PromptItem } from "./promptItem";

interface PromptOverlayProps {
  readonly prompt: PicturePrompt;
  readonly scale: number;
  readonly isExemplarShown: boolean;
  readonly isMarkShown: boolean;
  readonly activeObjectId: number | null;
  readonly selected: PromptItem | null;
  readonly hovered: PromptItem | null;
  // Chooses the drawing clicked on; null while a drawing tool is on, so clicks draw instead.
  readonly onPick: ((item: PromptItem) => void) | null;
}

export const POSITIVE_COLOR = "#16a34a";
export const NEGATIVE_COLOR = "#dc2626";
const INK = "#ffffff";
const HALO = "rgba(0, 0, 0, 0.55)";
const CHIP_BACKGROUND = "rgba(20, 22, 28, 0.78)";
const PIN_RADIUS = 7;
const CHIP_FONT_SIZE = 11;
const CHIP_HEIGHT = 16;
const INACTIVE_OPACITY = 0.55;
const EMPHASIS = "var(--accent)";
const EDGE_HIT_WIDTH = 12;
const PIN_HIT_MARGIN = 3;

interface ChipProps {
  readonly x: number;
  readonly y: number;
  readonly unit: number;
  readonly sign: "+" | "−" | null;
  readonly text: string;
}

/**
 * Dark label of a drawing, unlike the class-coloured labels of results.
 */
function Chip({ x, y, unit, sign, text }: ChipProps) {
  const signWidth = sign === null ? 0 : 10;
  const width = (text.length * 6.4 + signWidth + 10) * unit;
  const baseline = y + (CHIP_HEIGHT - 4.5) * unit;
  return (
    <g>
      <rect x={x} y={y} width={width} height={CHIP_HEIGHT * unit} rx={4 * unit} fill={CHIP_BACKGROUND} />
      {sign !== null && (
        <text
          x={x + 5 * unit}
          y={baseline}
          fontSize={(CHIP_FONT_SIZE + 2) * unit}
          fontWeight={700}
          fill={sign === "+" ? "#4ade80" : "#f87171"}
        >
          {sign}
        </text>
      )}
      <text x={x + (5 + signWidth) * unit} y={baseline} fontSize={CHIP_FONT_SIZE * unit} fontWeight={600} fill={INK}>
        {text}
      </text>
    </g>
  );
}

function OutlinedBox({ box, isDashed, stroke }: { readonly box: Box; readonly isDashed: boolean; readonly stroke: string }) {
  const [left, top, right, bottom] = box;
  const shape = { x: left, y: top, width: right - left, height: bottom - top, vectorEffect: "non-scaling-stroke" } as const;
  return (
    <g>
      <rect {...shape} fill="none" stroke={HALO} strokeWidth={3.5} />
      <rect {...shape} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray={isDashed ? "6 4" : undefined} />
    </g>
  );
}

function Pin({ point, isPositive, unit }: { readonly point: [number, number]; readonly isPositive: boolean; readonly unit: number }) {
  const [x, y] = point;
  const arm = 3.2 * unit;
  return (
    <g>
      <circle cx={x} cy={y} r={(PIN_RADIUS + 1.3) * unit} fill={HALO} />
      <circle
        cx={x}
        cy={y}
        r={PIN_RADIUS * unit}
        fill={isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR}
        stroke={INK}
        strokeWidth={1.6 * unit}
      />
      <path
        d={isPositive ? `M${x - arm} ${y}h${2 * arm}M${x} ${y - arm}v${2 * arm}` : `M${x - arm} ${y}h${2 * arm}`}
        stroke={INK}
        strokeWidth={1.7 * unit}
        strokeLinecap="round"
      />
    </g>
  );
}

function EmphasizedBox({ box, isStrong }: { readonly box: Box; readonly isStrong: boolean }) {
  const [left, top, right, bottom] = box;
  return (
    <rect
      x={left}
      y={top}
      width={right - left}
      height={bottom - top}
      fill="none"
      stroke={EMPHASIS}
      strokeOpacity={isStrong ? 0.95 : 0.6}
      strokeWidth={7}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function pointsOf(mark: MarkEntry): [number, number][] {
  return [...mark.positive_points, ...mark.negative_points];
}

function areaOf([left, top, right, bottom]: Box): number {
  return (right - left) * (bottom - top);
}

interface EdgeTarget {
  item: PromptItem;
  box: Box;
}

/**
 * Invisible targets choosing a drawing: box edges and pins only, so a click inside a box still reaches the result
 * under it, and smaller boxes lie above larger ones so a box drawn inside another stays reachable.
 */
function PickTargets({
  prompt,
  unit,
  isExemplarShown,
  isMarkShown,
  onPick,
}: {
  readonly prompt: PicturePrompt;
  readonly unit: number;
  readonly isExemplarShown: boolean;
  readonly isMarkShown: boolean;
  readonly onPick: (item: PromptItem) => void;
}) {
  const pick = (item: PromptItem) => (event: PointerEvent<SVGElement>) => {
    if (event.button !== 0 || event.shiftKey || event.altKey) return;
    event.stopPropagation();
    onPick(item);
  };
  const edges: EdgeTarget[] = [
    ...(isExemplarShown
      ? prompt.exemplars.map((exemplar): EdgeTarget => ({ item: { kind: "exemplar", index: exemplar.index }, box: exemplar.box }))
      : []),
    ...(isMarkShown
      ? prompt.marks.flatMap((mark): EdgeTarget[] =>
          mark.box === null ? [] : [{ item: { kind: "object", objectId: mark.object_id }, box: mark.box }],
        )
      : []),
  ].sort((left, right) => areaOf(right.box) - areaOf(left.box));
  return (
    <g style={{ cursor: "pointer" }}>
      {edges.map(({ item, box: [left, top, right, bottom] }) => (
        <rect
          key={item.kind === "exemplar" ? `exemplar-${item.index}` : `object-${item.objectId}`}
          x={left}
          y={top}
          width={right - left}
          height={bottom - top}
          fill="none"
          stroke="transparent"
          strokeWidth={EDGE_HIT_WIDTH}
          vectorEffect="non-scaling-stroke"
          pointerEvents="stroke"
          onPointerDown={pick(item)}
        />
      ))}
      {isMarkShown &&
        prompt.marks.flatMap((mark) =>
          pointsOf(mark).map(([x, y], index) => (
            <circle
              key={`pin-${mark.object_id}-${index}`}
              cx={x}
              cy={y}
              r={(PIN_RADIUS + PIN_HIT_MARGIN) * unit}
              fill="transparent"
              pointerEvents="all"
              onPointerDown={pick({ kind: "object", objectId: mark.object_id })}
            />
          )),
        )}
    </g>
  );
}

/**
 * Exemplar boxes and object marks drawn on the picture, in a neutral ink so they read apart from the results.
 * The chosen drawing and the one pointed at in the list are outlined in the accent colour.
 */
export function PromptOverlay({
  prompt,
  scale,
  isExemplarShown,
  isMarkShown,
  activeObjectId,
  selected,
  hovered,
  onPick,
}: PromptOverlayProps) {
  const unit = 1 / scale;
  const emphasisOf = (item: PromptItem): "strong" | "light" | null =>
    isSameItem(item, selected) ? "strong" : isSameItem(item, hovered) ? "light" : null;
  return (
    <>
      <g style={{ pointerEvents: "none" }}>
        {isExemplarShown &&
          prompt.exemplars.map((exemplar) => {
            const [left, top] = exemplar.box;
            const emphasis = emphasisOf({ kind: "exemplar", index: exemplar.index });
            return (
              <g key={`exemplar-${exemplar.index}`}>
                {emphasis !== null && <EmphasizedBox box={exemplar.box} isStrong={emphasis === "strong"} />}
                <OutlinedBox box={exemplar.box} isDashed={!exemplar.is_positive} stroke={exemplar.is_positive ? INK : NEGATIVE_COLOR} />
                <Chip
                  x={left}
                  y={top - (CHIP_HEIGHT + 3) * unit}
                  unit={unit}
                  sign={exemplar.is_positive ? "+" : "−"}
                  text={exemplar.class_name}
                />
              </g>
            );
          })}
        {isMarkShown &&
          prompt.marks.map((mark) => {
            const isActive = mark.object_id === activeObjectId;
            const first = mark.positive_points[0] ?? (mark.box === null ? null : ([mark.box[0], mark.box[1]] as [number, number]));
            const isHovered = !isActive && isSameItem({ kind: "object", objectId: mark.object_id }, hovered);
            return (
              <g
                key={`mark-${mark.object_id}`}
                opacity={isActive || isHovered || activeObjectId === null ? 1 : INACTIVE_OPACITY}
              >
                {isHovered && mark.box !== null && <EmphasizedBox box={mark.box} isStrong={false} />}
                {isHovered &&
                  pointsOf(mark).map(([x, y], index) => (
                    <circle
                      key={`emphasis-${index}`}
                      cx={x}
                      cy={y}
                      r={(PIN_RADIUS + 4.5) * unit}
                      fill={EMPHASIS}
                      fillOpacity={0.7}
                    />
                  ))}
                {mark.box !== null && <OutlinedBox box={mark.box} isDashed stroke={INK} />}
                {mark.positive_points.map((point, index) => (
                  <Pin key={`positive-${index}`} point={point} isPositive unit={unit} />
                ))}
                {mark.negative_points.map((point, index) => (
                  <Pin key={`negative-${index}`} point={point} isPositive={false} unit={unit} />
                ))}
                {!isActive && first !== null && (
                  <Chip
                    x={first[0] + (PIN_RADIUS + 4) * unit}
                    y={first[1] - (CHIP_HEIGHT + 4) * unit}
                    unit={unit}
                    sign={null}
                    text={`Object ${mark.object_id}`}
                  />
                )}
              </g>
            );
          })}
      </g>
      {onPick !== null && (
        <PickTargets
          prompt={prompt}
          unit={unit}
          isExemplarShown={isExemplarShown}
          isMarkShown={isMarkShown}
          onPick={onPick}
        />
      )}
    </>
  );
}
