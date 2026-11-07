import { useLayoutEffect, useRef, useState } from "react";

export interface BenchmarkPoint {
  key: string;
  family: string;
  familySlot: number;
  presetName: string;
  lvisAp: number;
  gflops: number;
}

interface ModelBenchmarkChartProps {
  points: BenchmarkPoint[];
  families: string[];
  currentKey: string | null;
  hoveredKey: string | null;
  onHover: (key: string | null) => void;
  onChoose: (key: string) => void;
}

const HEIGHT = 230;
const MARGIN = { top: 8, right: 12, bottom: 34, left: 40 };
const GFLOPS_DOMAIN: [number, number] = [80, 4500];
const GFLOPS_MAJOR = [100, 300, 1000, 3000];
const GFLOPS_MINOR = [90, 200, 400, 500, 600, 700, 800, 900, 2000, 4000];
const AP_DOMAIN: [number, number] = [15, 55];
const AP_MAJOR = [20, 30, 40, 50];
const AP_MINOR = [25, 35, 45];
const MAJOR_TICK = 6;
const MINOR_TICK = 3;
const MARK_SIZE = 10;
const HIT_RADIUS = 14;
const TOOLTIP_FLIP_RATIO = 0.6;
const SLOT_COUNT = 4;

function formattedGflops(value: number): string {
  return value >= 1000 ? `${value / 1000}k` : String(value);
}

function familyMark(
  slot: number,
  x: number,
  y: number,
  size: number,
  className: string,
) {
  const half = size / 2;
  switch (slot) {
    case 1:
      return (
        <rect
          className={className}
          x={x - half}
          y={y - half}
          width={size}
          height={size}
        />
      );
    case 2:
      return (
        <polygon
          className={className}
          points={`${x},${y - half * 1.15} ${x + half * 1.1},${y + half * 0.85} ${x - half * 1.1},${y + half * 0.85}`}
        />
      );
    case 3:
      return (
        <polygon
          className={className}
          points={`${x},${y - half * 1.2} ${x + half * 1.2},${y} ${x},${y + half * 1.2} ${x - half * 1.2},${y}`}
        />
      );
    default:
      return <circle className={className} cx={x} cy={y} r={half} />;
  }
}

function slotClassOf(slot: number): string {
  return slot < SLOT_COUNT ? `family-slot-${slot}` : "family-slot-other";
}

/**
 * Scatter of LVIS AP against GFLOPs on a log axis, so light and accurate models sit at the top left; color and shape
 * mark the family, the model in use is ringed, and hovering a mark names it.
 */
export function ModelBenchmarkChart({
  points,
  families,
  currentKey,
  hoveredKey,
  onHover,
  onChoose,
}: ModelBenchmarkChartProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = wrapper.current;
    if (element === null) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const logMinimum = Math.log10(GFLOPS_DOMAIN[0]);
  const logSpan = Math.log10(GFLOPS_DOMAIN[1]) - logMinimum;
  const xOf = (gflops: number) =>
    MARGIN.left + ((Math.log10(gflops) - logMinimum) / logSpan) * plotWidth;
  const yOf = (lvisAp: number) =>
    MARGIN.top +
    (1 - (lvisAp - AP_DOMAIN[0]) / (AP_DOMAIN[1] - AP_DOMAIN[0])) * plotHeight;
  const left = MARGIN.left;
  const right = MARGIN.left + plotWidth;
  const top = MARGIN.top;
  const bottom = MARGIN.top + plotHeight;

  const nearestKeyAt = (clientX: number, clientY: number): string | null => {
    const bounds = wrapper.current?.getBoundingClientRect();
    if (bounds === undefined) return null;
    const pointerX = clientX - bounds.left;
    const pointerY = clientY - bounds.top;
    let nearest: { key: string; distance: number } | null = null;
    for (const point of points) {
      const distance = Math.hypot(
        xOf(point.gflops) - pointerX,
        yOf(point.lvisAp) - pointerY,
      );
      if (
        distance <= HIT_RADIUS &&
        (nearest === null || distance < nearest.distance)
      )
        nearest = { key: point.key, distance };
    }
    return nearest?.key ?? null;
  };

  const hovered = points.find((point) => point.key === hoveredKey);
  const current = points.find((point) => point.key === currentKey);
  const ticks: string[] = [];
  for (const [values, length] of [
    [GFLOPS_MAJOR, MAJOR_TICK],
    [GFLOPS_MINOR, MINOR_TICK],
  ] as const)
    for (const value of values) {
      const x = xOf(value);
      ticks.push(`M${x},${bottom}v${-length}M${x},${top}v${length}`);
    }
  for (const [values, length] of [
    [AP_MAJOR, MAJOR_TICK],
    [AP_MINOR, MINOR_TICK],
  ] as const)
    for (const value of values) {
      const y = yOf(value);
      ticks.push(`M${left},${y}h${length}M${right},${y}h${-length}`);
    }
  const orderedPoints = hovered
    ? [...points.filter((point) => point.key !== hovered.key), hovered]
    : points;

  return (
    <div className="benchmark-chart">
      <div className="benchmark-legend small muted">
        {families.map((family, slot) => (
          <span key={family} className="benchmark-legend-entry">
            <svg width={MARK_SIZE + 4} height={MARK_SIZE + 4} aria-hidden>
              {familyMark(
                slot,
                (MARK_SIZE + 4) / 2,
                (MARK_SIZE + 4) / 2,
                MARK_SIZE,
                slotClassOf(slot),
              )}
            </svg>
            {family}
          </span>
        ))}
        {current !== undefined && (
          <span className="benchmark-legend-entry">
            <svg width={MARK_SIZE + 6} height={MARK_SIZE + 6} aria-hidden>
              <circle
                className="benchmark-current-ring"
                cx={(MARK_SIZE + 6) / 2}
                cy={(MARK_SIZE + 6) / 2}
                r={MARK_SIZE / 2 + 1}
              />
            </svg>
            In use
          </span>
        )}
      </div>
      <div
        ref={wrapper}
        className="benchmark-plot"
        style={{
          height: HEIGHT,
          cursor: hovered === undefined ? undefined : "pointer",
        }}
        onPointerMove={(event) =>
          onHover(nearestKeyAt(event.clientX, event.clientY))
        }
        onPointerLeave={() => onHover(null)}
        onClick={(event) => {
          const key = nearestKeyAt(event.clientX, event.clientY);
          if (key !== null) onChoose(key);
        }}
      >
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="LVIS AP against GFLOPs of each model"
          >
            <rect
              className="benchmark-frame"
              x={left}
              y={top}
              width={plotWidth}
              height={plotHeight}
            />
            <path className="benchmark-ticks" d={ticks.join("")} />
            {GFLOPS_MAJOR.map((value) => (
              <text
                key={value}
                className="benchmark-axis-label"
                x={xOf(value)}
                y={bottom + 14}
                textAnchor="middle"
              >
                {formattedGflops(value)}
              </text>
            ))}
            {AP_MAJOR.map((value) => (
              <text
                key={value}
                className="benchmark-axis-label"
                x={left - 6}
                y={yOf(value) + 4}
                textAnchor="end"
              >
                {value}
              </text>
            ))}
            <text
              className="benchmark-axis-title"
              x={(left + right) / 2}
              y={HEIGHT - 4}
              textAnchor="middle"
            >
              GFLOPs (log scale) — fewer is faster
            </text>
            <text
              className="benchmark-axis-title"
              transform={`translate(11 ${(top + bottom) / 2}) rotate(-90)`}
              textAnchor="middle"
            >
              LVIS AP
            </text>
            {current !== undefined && (
              <circle
                className="benchmark-current-ring"
                cx={xOf(current.gflops)}
                cy={yOf(current.lvisAp)}
                r={MARK_SIZE}
              />
            )}
            {orderedPoints.map((point) => (
              <g key={point.key}>
                {familyMark(
                  point.familySlot,
                  xOf(point.gflops),
                  yOf(point.lvisAp),
                  point.key === hoveredKey ? MARK_SIZE + 4 : MARK_SIZE,
                  `${slotClassOf(point.familySlot)}${point.key === hoveredKey ? " is-hovered" : ""}`,
                )}
              </g>
            ))}
          </svg>
        )}
        {hovered !== undefined && (
          <div
            className={`chart-tooltip benchmark-tooltip${xOf(hovered.gflops) > width * TOOLTIP_FLIP_RATIO ? " flipped" : ""}`}
            style={{
              left: xOf(hovered.gflops),
              top: Math.max(yOf(hovered.lvisAp) - 44, 0),
            }}
          >
            <div className="chart-tooltip-time">{hovered.family}</div>
            <div className="chart-tooltip-row focused">
              <span className="name">{hovered.presetName}</span>
            </div>
            <div className="chart-tooltip-row mono">
              AP {hovered.lvisAp.toFixed(1)} · {hovered.gflops.toFixed(0)}{" "}
              GFLOPs
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
