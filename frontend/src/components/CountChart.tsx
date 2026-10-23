import { memo, useMemo, useRef, useState } from "react";
import { usePointerDrag } from "../hooks/usePointerDrag";
import { type ClassColors, classColorOf } from "../lib/frameView";
import { clamp } from "../lib/numbers";
import type { ClassTrack, VideoEventSummary } from "../lib/videoEvents";
import { formatSeconds, tickSecondsOf } from "../lib/videoTime";

interface CountChartProps {
  summary: VideoEventSummary;
  frameCount: number;
  fps: number;
  classColors: ClassColors;
  hiddenClasses: ReadonlySet<string>;
  focusedClass: string | null;
  pinnedClass: string | null;
  onHoverClass: (className: string | null) => void;
  onPinClass: (className: string) => void;
  onToggleClass: (className: string) => void;
  onSeek: (frame: number, isFinal: boolean) => void;
}

interface TooltipRow {
  className: string;
  count: number;
}

interface CountScale {
  maximum: number;
  ticks: number[];
}

const CHART_HEIGHT = 140;
const PLOT_WIDTH = 1000;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 4;
const TICK_TARGET_COUNT = 4;
const NICE_STEPS = [1, 2, 5];
const TOOLTIP_ROW_LIMIT = 8;
const TOOLTIP_FLIP_RATIO = 0.55;
const DIMMED_OPACITY = 0.16;
const FOCUSED_STROKE_WIDTH = 2.5;
const STROKE_WIDTH = 1.5;

function scaleOf(largestCount: number): CountScale {
  const rough = Math.max(1, largestCount) / TICK_TARGET_COUNT;
  let magnitude = 1;
  while (magnitude * 10 <= rough) magnitude *= 10;
  const step = (NICE_STEPS.find((candidate) => candidate * magnitude >= rough) ?? 10) * magnitude;
  const maximum = Math.max(step, Math.ceil(Math.max(1, largestCount) / step) * step);
  const ticks: number[] = [];
  for (let tick = 0; tick <= maximum; tick += step) ticks.push(tick);
  return { maximum, ticks };
}

function yOf(count: number, scale: CountScale): number {
  return PLOT_TOP + (1 - count / scale.maximum) * (CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM);
}

function nearestPositionOf(sampleFrames: readonly number[], frame: number): number {
  let low = 0;
  let high = sampleFrames.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if ((sampleFrames[middle] ?? 0) <= frame) low = middle;
    else high = middle - 1;
  }
  return low;
}

function stepPathOf(track: ClassTrack, sampleFrames: readonly number[], frameCount: number, scale: CountScale): string {
  const steps = track.counts.map((count, position) => {
    const x = ((sampleFrames[position] ?? 0) / frameCount) * PLOT_WIDTH;
    const y = yOf(count, scale).toFixed(2);
    return position === 0 ? `M${x.toFixed(2)} ${y}` : `H${x.toFixed(2)} V${y}`;
  });
  return `${steps.join(" ")} H${PLOT_WIDTH}`;
}

/**
 * Draws how many boxes of every class are kept on each sampled frame of a video on one shared axis, with one class
 * brought to the front together with its events.
 */
export const CountChart = memo(function CountChart({
  summary,
  frameCount,
  fps,
  classColors,
  hiddenClasses,
  focusedClass,
  pinnedClass,
  onHoverClass,
  onPinClass,
  onToggleClass,
  onSeek,
}: CountChartProps) {
  const plot = useRef<HTMLDivElement>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const { tracks, events, sampleFrames } = summary;
  const durationSeconds = frameCount / fps;
  const xOf = (frame: number): number => (frame / frameCount) * PLOT_WIDTH;
  const scale = useMemo(() => scaleOf(Math.max(0, ...tracks.map((track) => track.peakCount))), [tracks]);
  const linePaths = useMemo(
    () => new Map(tracks.map((track) => [track.className, stepPathOf(track, sampleFrames, frameCount, scale)])),
    [tracks, sampleFrames, frameCount, scale],
  );
  const visibleTracks = tracks.filter((track) => !hiddenClasses.has(track.className));
  const focusedTrack = visibleTracks.find((track) => track.className === focusedClass) ?? null;
  const backgroundTracks = visibleTracks.filter((track) => track !== focusedTrack);
  const focusedColor = focusedTrack === null ? null : classColorOf(classColors, focusedTrack.className);
  const firstX = xOf(sampleFrames[0] ?? 0);

  const frameAt = (clientX: number): number => {
    const bounds = plot.current?.getBoundingClientRect();
    if (bounds === undefined || bounds.width <= 0) return 0;
    const ratio = clamp((clientX - bounds.left) / bounds.width, 0, 1);
    return Math.min(frameCount - 1, Math.round(ratio * frameCount));
  };

  const drag = usePointerDrag<HTMLDivElement>({
    onDrag: (event) => onSeek(frameAt(event.clientX), false),
    onDrop: (event) => onSeek(frameAt(event.clientX), true),
  });

  const hoverFrame = hoverPosition === null ? null : (sampleFrames[hoverPosition] ?? null);
  const tooltipRows: TooltipRow[] =
    hoverPosition === null
      ? []
      : visibleTracks
          .map((track) => ({ className: track.className, count: track.counts[hoverPosition] ?? 0 }))
          .filter((row) => row.count > 0)
          .sort((left, right) => right.count - left.count || left.className.localeCompare(right.className))
          .slice(0, TOOLTIP_ROW_LIMIT);
  const hoverRatio = hoverFrame === null ? 0 : hoverFrame / frameCount;

  return (
    <div className="chart-grid">
      <div className="track-corner" />
      <div className="track-ruler">
        {tickSecondsOf(durationSeconds).map((seconds) => (
          <span key={seconds} style={{ left: `${(seconds / durationSeconds) * 100}%` }}>
            {formatSeconds(seconds)}
          </span>
        ))}
      </div>
      <div className="chart-legend" style={{ height: CHART_HEIGHT }} onMouseLeave={() => onHoverClass(null)}>
        {tracks.map((track) => {
          const color = classColorOf(classColors, track.className);
          const isHidden = hiddenClasses.has(track.className);
          const classNames = [
            "chart-legend-row",
            isHidden ? "hidden" : "",
            track.className === focusedTrack?.className ? "focused" : "",
            track.className === pinnedClass ? "pinned" : "",
          ];
          return (
            <div
              key={track.className}
              className={classNames.filter((name) => name !== "").join(" ")}
              onMouseEnter={() => onHoverClass(track.className)}
            >
              <button
                className="chart-legend-toggle"
                title={isHidden ? `Show ${track.className}` : `Hide ${track.className}`}
                onClick={() => onToggleClass(track.className)}
              >
                <span className="swatch" style={{ background: isHidden ? "transparent" : color, borderColor: color }} />
              </button>
              <button
                className="chart-legend-name"
                title={`${track.className}: ${track.eventCount} events on ${track.keptSampleCount} sampled frames, at most ${track.peakCount} boxes on one frame. Click to keep it in front.`}
                onClick={() => onPinClass(track.className)}
              >
                <span className="name">{track.className}</span>
                <span className="count">{track.eventCount}</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="chart-axis" style={{ height: CHART_HEIGHT }}>
        {scale.ticks.map((tick) => (
          <span key={tick} className="chart-axis-label" style={{ top: yOf(tick, scale) }}>
            {tick}
          </span>
        ))}
      </div>
      <div
        ref={plot}
        className="chart-plot"
        style={{ height: CHART_HEIGHT }}
        onPointerDown={drag.onPointerDown}
        onPointerMove={(event) => {
          setHoverPosition(
            sampleFrames.length === 0 ? null : nearestPositionOf(sampleFrames, frameAt(event.clientX)),
          );
          drag.onPointerMove(event);
        }}
        onPointerUp={drag.onPointerUp}
        onPointerLeave={() => setHoverPosition(null)}
      >
        <svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${PLOT_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
          {scale.ticks.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={PLOT_WIDTH}
              y1={yOf(tick, scale)}
              y2={yOf(tick, scale)}
              stroke={tick === 0 ? "var(--border-strong)" : "var(--border)"}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {focusedTrack !== null &&
            focusedColor !== null &&
            events
              .filter((event) => event.className === focusedTrack.className)
              .map((event) => (
                <rect
                  key={event.key}
                  x={xOf(event.startFrame)}
                  y={PLOT_TOP}
                  width={Math.max(1, xOf(event.shownEndFrame) - xOf(event.startFrame))}
                  height={yOf(0, scale) - PLOT_TOP}
                  fill={focusedColor}
                  opacity={0.1}
                />
              ))}
          {backgroundTracks.map((track) => (
            <path
              key={track.className}
              d={linePaths.get(track.className)}
              fill="none"
              stroke={classColorOf(classColors, track.className)}
              strokeWidth={STROKE_WIDTH}
              strokeLinejoin="round"
              opacity={focusedTrack === null ? 0.9 : DIMMED_OPACITY}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {focusedTrack !== null && focusedColor !== null && (
            <>
              <path
                d={`${linePaths.get(focusedTrack.className) ?? ""} V${yOf(0, scale)} H${firstX.toFixed(2)} Z`}
                fill={focusedColor}
                opacity={0.14}
              />
              <path
                d={linePaths.get(focusedTrack.className)}
                fill="none"
                stroke={focusedColor}
                strokeWidth={FOCUSED_STROKE_WIDTH}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          {hoverFrame !== null && (
            <line
              x1={xOf(hoverFrame)}
              x2={xOf(hoverFrame)}
              y1={0}
              y2={CHART_HEIGHT}
              stroke="var(--text-muted)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {hoverFrame !== null && (
          <div
            className={`chart-tooltip${hoverRatio > TOOLTIP_FLIP_RATIO ? " flipped" : ""}`}
            style={{ left: `${hoverRatio * 100}%` }}
          >
            <div className="chart-tooltip-time mono">
              {formatSeconds(hoverFrame / fps)} · #{hoverFrame}
            </div>
            {tooltipRows.length === 0 ? (
              <div className="muted">nothing kept</div>
            ) : (
              tooltipRows.map((row) => (
                <div
                  key={row.className}
                  className={`chart-tooltip-row${row.className === focusedTrack?.className ? " focused" : ""}`}
                >
                  <span className="swatch" style={{ background: classColorOf(classColors, row.className) }} />
                  <span className="name">{row.className}</span>
                  <span className="mono">{row.count}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
});
