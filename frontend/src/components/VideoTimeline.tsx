import { useRef } from "react";
import type { TimelinePayload } from "../api/types";

interface VideoTimelineProps {
  timeline: TimelinePayload | null;
  frameCount: number;
  frame: number;
  isClassification: boolean;
  onSeek: (frame: number, isFinal: boolean) => void;
}

const ROW_HEIGHT = 7;
const MAX_ROWS = 8;
const TOP_ROW_HEIGHT = 10;

export function VideoTimeline({ timeline, frameCount, frame, isClassification, onSeek }: VideoTimelineProps) {
  const element = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastFrame = Math.max(1, frameCount - 1);
  const frames = timeline?.frames ?? [];
  const rows = (timeline?.classes ?? []).filter((entry) => entry.values.some((value) => value > 0)).slice(0, MAX_ROWS);
  const largest = Math.max(1, ...rows.flatMap((entry) => entry.values));
  const height = TOP_ROW_HEIGHT + rows.length * ROW_HEIGHT + 4;
  const widthOf = (position: number) => {
    const start = frames[position] ?? 0;
    const end = frames[position + 1] ?? Math.min(frameCount, start + (timeline?.frame_step ?? 1));
    return Math.max(0.0005, (end - start) / frameCount);
  };

  const frameAt = (clientX: number) => {
    const bounds = element.current?.getBoundingClientRect();
    if (bounds === undefined || bounds.width <= 0) return frame;
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    return Math.round(ratio * lastFrame);
  };

  return (
    <div
      ref={element}
      className="timeline"
      style={{ height }}
      onPointerDown={(event) => {
        isDragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        onSeek(frameAt(event.clientX), false);
      }}
      onPointerMove={(event) => {
        if (isDragging.current) onSeek(frameAt(event.clientX), false);
      }}
      onPointerUp={(event) => {
        if (!isDragging.current) return;
        isDragging.current = false;
        onSeek(frameAt(event.clientX), true);
      }}
      title="Click or drag to seek; marks show recognized frames and where each class was found"
    >
      <svg width="100%" height={height} viewBox={`0 0 1 ${height}`} preserveAspectRatio="none">
        <rect x={0} y={0} width={1} height={height} fill="var(--timeline-bg)" />
        {frames.map((index, position) => {
          const topClass = timeline?.top_classes[position] ?? null;
          const color = topClass === null ? "var(--timeline-mark)" : (timeline?.classes.find((entry) => entry.name === topClass)?.color ?? "var(--timeline-mark)");
          return (
            <rect
              key={`m-${index}`}
              x={index / frameCount}
              y={1}
              width={widthOf(position)}
              height={isClassification ? TOP_ROW_HEIGHT - 2 : 3}
              fill={color}
              opacity={isClassification && topClass !== null ? 0.9 : 0.6}
            />
          );
        })}
        {rows.map((entry, row) =>
          entry.values.map((value, position) =>
            value > 0 ? (
              <rect
                key={`${entry.name}-${position}`}
                x={(frames[position] ?? 0) / frameCount}
                y={TOP_ROW_HEIGHT + row * ROW_HEIGHT}
                width={widthOf(position)}
                height={ROW_HEIGHT - 1}
                fill={entry.color}
                opacity={isClassification ? Math.max(0.15, value) : Math.max(0.35, value / largest)}
              />
            ) : null,
          ),
        )}
        <rect x={frame / frameCount} y={0} width={Math.max(0.002, 1 / frameCount)} height={height} fill="var(--timeline-cursor)" />
      </svg>
      {rows.length > 0 && (
        <div className="timeline-legend">
          {rows.map((entry) => (
            <span key={entry.name} style={{ color: entry.color }}>
              ■ {entry.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
