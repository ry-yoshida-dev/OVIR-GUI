import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CurrentPicture, TaskValue } from "../api/types";
import { FALLBACK_CLASS_COLOR } from "../lib/frameView";
import type { FrameResultIndex } from "../lib/frameResultIndex";
import type { PlaybackPosition } from "../lib/playbackPosition";
import type { ResultScope } from "../lib/resultTable";
import { taskViewOf } from "../lib/taskViews";
import { type ClassTrack, type VideoEvent, VideoEventBuilder } from "../lib/videoEvents";
import { NumberField } from "./NumberField";
import { ResultScopeToggle } from "./ResultScopeToggle";

interface VideoFindingsPanelProps {
  task: TaskValue;
  current: CurrentPicture;
  results: FrameResultIndex | null;
  position: PlaybackPosition;
  isFollowingPlayer: boolean;
  classColors: Record<string, string>;
  scope: ResultScope;
  isScopeSelectable: boolean;
  onScopeChange: (scope: ResultScope) => void;
  onSeek: (frame: number, isFinal: boolean) => void;
}

interface TrackLanesProps {
  tracks: ClassTrack[];
  events: VideoEvent[];
  frameCount: number;
  fps: number;
  hiddenClasses: ReadonlySet<string>;
  classColors: Record<string, string>;
  onToggleClass: (className: string) => void;
  onSeek: (frame: number, isFinal: boolean) => void;
}

const LANE_HEIGHT = 18;
const RULER_HEIGHT = 18;
const LABEL_WIDTH = 132;
const TICK_TARGET_COUNT = 6;
const NICE_SECONDS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

function tickSecondsOf(durationSeconds: number): number[] {
  const rough = durationSeconds / TICK_TARGET_COUNT;
  const step = NICE_SECONDS.find((candidate) => candidate >= rough) ?? Math.ceil(rough / 3600) * 3600;
  const ticks: number[] = [];
  for (let seconds = 0; seconds <= durationSeconds; seconds += step) ticks.push(seconds);
  return ticks;
}

function colorOf(classColors: Record<string, string>, className: string): string {
  return classColors[className] ?? FALLBACK_CLASS_COLOR;
}

const TrackLanes = memo(function TrackLanes({
  tracks,
  events,
  frameCount,
  fps,
  hiddenClasses,
  classColors,
  onToggleClass,
  onSeek,
}: TrackLanesProps) {
  const lanes = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const durationSeconds = frameCount / fps;
  const frameAt = (clientX: number): number => {
    const bounds = lanes.current?.getBoundingClientRect();
    if (bounds === undefined || bounds.width <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    return Math.min(frameCount - 1, Math.round(ratio * frameCount));
  };

  return (
    <div className="track-grid" style={{ gridTemplateColumns: `${LABEL_WIDTH}px 1fr` }}>
      <div className="track-corner" style={{ height: RULER_HEIGHT }} />
      <div className="track-ruler" style={{ height: RULER_HEIGHT }}>
        {tickSecondsOf(durationSeconds).map((seconds) => (
          <span key={seconds} style={{ left: `${(seconds / durationSeconds) * 100}%` }}>
            {formatSeconds(seconds)}
          </span>
        ))}
      </div>
      <div className="track-labels">
        {tracks.map((track) => {
          const isHidden = hiddenClasses.has(track.className);
          return (
            <button
              key={track.className}
              className={`track-label${isHidden ? " hidden" : ""}`}
              style={{ height: LANE_HEIGHT }}
              title={`${track.className}: ${track.eventCount} events on ${track.sampleCount} sampled frames. Click to hide or show its events.`}
              onClick={() => onToggleClass(track.className)}
            >
              <span className="swatch" style={{ background: colorOf(classColors, track.className) }} />
              <span className="name">{track.className}</span>
              <span className="count">{track.eventCount}</span>
            </button>
          );
        })}
      </div>
      <div
        ref={lanes}
        className="track-lanes"
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
      >
        <svg width="100%" height={tracks.length * LANE_HEIGHT} viewBox={`0 0 1 ${tracks.length * LANE_HEIGHT}`} preserveAspectRatio="none">
          {tracks.map((track, row) => {
            const color = colorOf(classColors, track.className);
            const top = row * LANE_HEIGHT;
            const isHidden = hiddenClasses.has(track.className);
            return (
              <g key={track.className} opacity={isHidden ? 0.25 : 1}>
                <rect x={0} y={top} width={1} height={LANE_HEIGHT} fill={row % 2 === 0 ? "var(--track-lane)" : "var(--track-lane-alt)"} />
                {events
                  .filter((event) => event.className === track.className)
                  .map((event) => (
                    <rect
                      key={event.key}
                      x={event.startFrame / frameCount}
                      y={top + LANE_HEIGHT - 4}
                      width={Math.max(0.001, (event.shownEndFrame - event.startFrame) / frameCount)}
                      height={2}
                      fill={color}
                    />
                  ))}
                {track.samples.map((sample) => (
                  <rect
                    key={sample.frame}
                    x={sample.frame / frameCount}
                    y={top + 3}
                    width={Math.max(0.0008, (sample.nextFrame - sample.frame) / frameCount)}
                    height={LANE_HEIGHT - 8}
                    fill={color}
                    opacity={0.2 + 0.8 * sample.confidence}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
});

function PlaybackCursor({ frame, frameCount }: { frame: number; frameCount: number }) {
  return (
    <div className="track-cursor-layer" style={{ left: LABEL_WIDTH }}>
      <div className="track-cursor" style={{ left: `${(frame / frameCount) * 100}%` }} />
    </div>
  );
}

export function VideoFindingsPanel({
  task,
  current,
  results,
  position,
  isFollowingPlayer,
  classColors,
  scope,
  isScopeSelectable,
  onScopeChange,
  onSeek,
}: VideoFindingsPanelProps) {
  const [allowedMissCount, setAllowedMissCount] = useState(1);
  const [hiddenClasses, setHiddenClasses] = useState<ReadonlySet<string>>(new Set());
  const [isFollowing, setIsFollowing] = useState(true);
  const list = useRef<HTMLDivElement>(null);
  const playedFrame = useSyncExternalStore(position.subscribe, position.current);
  const frame = (isFollowingPlayer ? playedFrame : null) ?? current.frame ?? 0;
  const frameCount = Math.max(1, current.frame_count ?? 1);
  const fps = current.fps ?? 30;
  const summary = useMemo(
    () => new VideoEventBuilder(results?.recognizedFrames ?? [], frameCount, allowedMissCount).build(),
    [results, frameCount, allowedMissCount],
  );
  const listedEvents = useMemo(
    () => summary.events.filter((event) => !hiddenClasses.has(event.className)),
    [summary.events, hiddenClasses],
  );
  const activeKeys = new Set(
    listedEvents.filter((event) => frame >= event.startFrame && frame < event.shownEndFrame).map((event) => event.key),
  );
  const firstActiveKey = listedEvents.find((event) => activeKeys.has(event.key))?.key ?? null;
  const nowFindings = useMemo(() => {
    const shown = results?.resultAt(frame) ?? null;
    if (shown === null || !shown.is_recognized) return [];
    const counts = new Map<string, number>();
    for (const finding of shown.findings) {
      if (finding.is_accepted) counts.set(finding.class_name, (counts.get(finding.class_name) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [results, frame]);

  useEffect(() => {
    if (!isFollowing || firstActiveKey === null) return;
    list.current?.querySelector(`[data-event-key="${CSS.escape(firstActiveKey)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [isFollowing, firstActiveKey]);

  const toggleClass = (className: string) =>
    setHiddenClasses((hidden) => {
      const next = new Set(hidden);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });

  const timeOf = (eventFrame: number) => formatSeconds(eventFrame / fps);

  return (
    <div className="video-findings">
      <div className="panel-title">
        <span>{taskViewOf(task).resultTitle}</span>
        {isScopeSelectable && <ResultScopeToggle scope={scope} onChange={onScopeChange} />}
        <span className="grow" />
        <span className="muted small">
          {summary.events.length} events · {summary.recognizedCount} sampled frames
        </span>
      </div>
      {results === null || summary.recognizedCount === 0 ? (
        <div className="video-findings-empty muted">
          {results === null ? "Loading the results of this video…" : "No recognized frames yet. Run Video to recognize the sampled frames."}
        </div>
      ) : (
        <>
          <div className="video-findings-tracks">
            {summary.tracks.length === 0 ? (
              <div className="video-findings-empty muted">Nothing kept on the recognized frames.</div>
            ) : (
              <>
                <TrackLanes
                  tracks={summary.tracks}
                  events={summary.events}
                  frameCount={frameCount}
                  fps={fps}
                  hiddenClasses={hiddenClasses}
                  classColors={classColors}
                  onToggleClass={toggleClass}
                  onSeek={onSeek}
                />
                <PlaybackCursor frame={frame} frameCount={frameCount} />
              </>
            )}
          </div>
          <div className="video-findings-now">
            <span className="mono small">
              {formatSeconds(frame / fps)} · #{frame}
            </span>
            {nowFindings.length === 0 ? (
              <span className="muted small">nothing here</span>
            ) : (
              nowFindings.map(([className, count]) => (
                <span key={className} className="now-chip">
                  <span className="swatch" style={{ background: colorOf(classColors, className) }} />
                  {className}
                  {count > 1 && <b>×{count}</b>}
                </span>
              ))
            )}
          </div>
          <div className="video-findings-bar">
            <span className="small">Events</span>
            <span className="grow" />
            <label className="small" title="Scroll the event list to follow the playback position">
              <input type="checkbox" checked={isFollowing} onChange={(event) => setIsFollowing(event.target.checked)} />
              Follow
            </label>
            <span className="small muted" title="Sampled frames without the class that still belong to the same event">
              bridge gaps of
            </span>
            <NumberField
              value={allowedMissCount}
              minimum={0}
              maximum={1000}
              step={1}
              width={48}
              onCommit={(value) => setAllowedMissCount(Math.max(0, Math.round(value)))}
            />
            <span className="small muted">samples</span>
          </div>
          <div ref={list} className="video-event-list">
            <table className="grid">
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Start</th>
                  <th>End</th>
                  <th className="number">Length</th>
                  <th className="number" title="Highest confidence in the event; click to jump to it">
                    Peak
                  </th>
                  <th className="number" title="Most findings of the class on one frame">
                    Max
                  </th>
                </tr>
              </thead>
              <tbody>
                {listedEvents.map((event) => (
                  <tr
                    key={event.key}
                    data-event-key={event.key}
                    className={activeKeys.has(event.key) ? "current" : ""}
                    onClick={() => onSeek(event.startFrame, true)}
                    title={`Frames #${event.startFrame}–#${event.endFrame} on ${event.sampleCount} sampled frames`}
                  >
                    <td>
                      <span className="swatch event-swatch" style={{ background: colorOf(classColors, event.className) }} />
                      {event.className}
                    </td>
                    <td className="mono">{timeOf(event.startFrame)}</td>
                    <td className="mono">{timeOf(event.shownEndFrame)}</td>
                    <td className="mono number">{((event.shownEndFrame - event.startFrame) / fps).toFixed(1)}s</td>
                    <td
                      className="mono number link"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onSeek(event.peakFrame, true);
                      }}
                    >
                      {event.peakConfidence.toFixed(2)}
                    </td>
                    <td className="mono number">{event.maximumCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
