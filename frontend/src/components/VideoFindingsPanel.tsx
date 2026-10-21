import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CurrentPicture, MediaEntry } from "../api/types";
import { FALLBACK_CLASS_COLOR } from "../lib/frameView";
import type { FrameResultIndex } from "../lib/frameResultIndex";
import type { PlaybackPosition } from "../lib/playbackPosition";
import { VideoEventBuilder } from "../lib/videoEvents";
import { formatSeconds } from "../lib/videoTime";
import { CHART_LABEL_WIDTH, CountChart } from "./CountChart";
import { NumberField } from "./NumberField";
import { ResultsHeading } from "./ResultsHeading";

interface VideoFindingsPanelProps {
  video: MediaEntry;
  current: CurrentPicture | null;
  results: FrameResultIndex | null;
  position: PlaybackPosition;
  isFollowingPlayer: boolean;
  classColors: Record<string, string>;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onSeek: (frame: number, isFinal: boolean) => void;
}

function colorOf(classColors: Record<string, string>, className: string): string {
  return classColors[className] ?? FALLBACK_CLASS_COLOR;
}

function PlaybackCursor({ frame, frameCount }: { frame: number; frameCount: number }) {
  return (
    <div className="track-cursor-layer" style={{ left: CHART_LABEL_WIDTH }}>
      <div className="track-cursor" style={{ left: `${(frame / frameCount) * 100}%` }} />
    </div>
  );
}

/**
 * Charts and lists the findings of one video, which stays shown while other media are open.
 */
export function VideoFindingsPanel({
  video,
  current,
  results,
  position,
  isFollowingPlayer,
  classColors,
  isCollapsed,
  onToggleCollapsed,
  onSeek,
}: VideoFindingsPanelProps) {
  const [allowedMissCount, setAllowedMissCount] = useState(1);
  const [hiddenClasses, setHiddenClasses] = useState<ReadonlySet<string>>(new Set());
  const [hoveredClass, setHoveredClass] = useState<string | null>(null);
  const [pinnedClass, setPinnedClass] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const list = useRef<HTMLDivElement>(null);
  const playedFrame = useSyncExternalStore(position.subscribe, position.current);
  const frame = current === null ? null : ((isFollowingPlayer ? playedFrame : null) ?? current.frame ?? 0);
  const frameCount = Math.max(1, current?.frame_count ?? video.frame_count ?? 1);
  const fps = current?.fps ?? video.fps ?? 30;
  const summary = useMemo(
    () => new VideoEventBuilder(results?.recognizedFrames ?? [], frameCount, allowedMissCount).build(),
    [results, frameCount, allowedMissCount],
  );
  const listedEvents = useMemo(
    () => summary.events.filter((event) => !hiddenClasses.has(event.className)),
    [summary.events, hiddenClasses],
  );
  const activeKeys = new Set(
    frame === null
      ? []
      : listedEvents.filter((event) => frame >= event.startFrame && frame < event.shownEndFrame).map((event) => event.key),
  );
  const firstActiveKey = listedEvents.find((event) => activeKeys.has(event.key))?.key ?? null;
  const nowFindings = useMemo(() => {
    if (frame === null) return [];
    const shown = results?.resultAt(frame) ?? null;
    if (shown === null || !shown.is_recognized) return [];
    const counts = new Map<string, number>();
    for (const finding of shown.findings) {
      if (finding.is_accepted && finding.is_passing) counts.set(finding.class_name, (counts.get(finding.class_name) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [results, frame]);

  useEffect(() => {
    const container = list.current;
    if (!isFollowing || firstActiveKey === null || container === null) return;
    const row = container.querySelector(`[data-event-key="${CSS.escape(firstActiveKey)}"]`);
    if (row === null) return;
    const rowBounds = row.getBoundingClientRect();
    const listBounds = container.getBoundingClientRect();
    const headerHeight = container.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    const visibleTop = listBounds.top + headerHeight;
    if (rowBounds.top < visibleTop) container.scrollTop -= visibleTop - rowBounds.top;
    else if (rowBounds.bottom > listBounds.bottom) container.scrollTop += rowBounds.bottom - listBounds.bottom;
  }, [isFollowing, firstActiveKey, isCollapsed]);

  const toggleClass = useCallback(
    (className: string) =>
      setHiddenClasses((hidden) => {
        const next = new Set(hidden);
        if (next.has(className)) next.delete(className);
        else next.add(className);
        return next;
      }),
    [],
  );
  const pinClass = useCallback(
    (className: string) => setPinnedClass((pinned) => (pinned === className ? null : className)),
    [],
  );
  const focusedClass = hoveredClass ?? pinnedClass;

  const timeOf = (eventFrame: number) => formatSeconds(eventFrame / fps);

  return (
    <div className="video-findings">
      <ResultsHeading title="Videos" isCollapsed={isCollapsed} onToggle={onToggleCollapsed}>
        <span className="muted small results-heading-name" title={video.path}>
          {video.name}
        </span>
        <span className="grow" />
        <span className="muted small">
          {summary.events.length} events · {summary.recognizedCount} sampled frames
        </span>
      </ResultsHeading>
      {isCollapsed ? null : results === null || summary.recognizedCount === 0 ? (
        <div className="video-findings-empty muted">
          {results === null ? "Loading the results of this video…" : "No inferred frames yet. Run Video to infer the sampled frames."}
        </div>
      ) : (
        <>
          <div className="video-findings-tracks">
            {summary.tracks.length === 0 ? (
              <div className="video-findings-empty muted">Nothing kept on the inferred frames.</div>
            ) : (
              <>
                <CountChart
                  summary={summary}
                  frameCount={frameCount}
                  fps={fps}
                  classColors={classColors}
                  hiddenClasses={hiddenClasses}
                  focusedClass={focusedClass}
                  pinnedClass={pinnedClass}
                  onHoverClass={setHoveredClass}
                  onPinClass={pinClass}
                  onToggleClass={toggleClass}
                  onSeek={onSeek}
                />
                {frame !== null && <PlaybackCursor frame={frame} frameCount={frameCount} />}
              </>
            )}
          </div>
          <div className="video-findings-now">
            {frame === null ? (
              <span className="muted small">Click the chart or an event to open this video.</span>
            ) : (
              <span className="mono small">
                {formatSeconds(frame / fps)} · #{frame}
              </span>
            )}
            {frame === null ? null : nowFindings.length === 0 ? (
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
                    onMouseEnter={() => setHoveredClass(event.className)}
                    onMouseLeave={() => setHoveredClass(null)}
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
