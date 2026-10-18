import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IndexBase, PlaybackState, type PlayerController, type PlayerSnapshot } from "@video-player-ui/core";
import { FrameCanvas, usePlayerController, usePlayerShortcut, VideoPlayer, type FrameDrawContext, type FramePointer } from "@video-player-ui/web";
import { api } from "../api/client";
import type { CurrentPicture, FramePayload } from "../api/types";
import type { DisplayOptions } from "../lib/displayOptions";
import { FindingPainter, type FrameScene } from "../lib/findingPainter";
import type { FrameResultIndex } from "../lib/frameResultIndex";
import { visibleInstancesOf } from "../lib/frameView";
import { pictureKeyOf } from "../lib/resultTable";
import { ScorePanel } from "./ScorePanel";

export interface HighlightedFinding {
  frame: number | null;
  index: number;
}

interface VideoResultPlayerProps {
  current: CurrentPicture;
  frame: FramePayload | null;
  results: FrameResultIndex | null;
  listed: Map<string, Set<number>> | null;
  highlighted: HighlightedFinding | null;
  options: DisplayOptions;
  classColors: Record<string, string>;
  onSeek: (frame: number, isFinal: boolean) => void;
  onSelectFinding: (resultFrame: number | null, index: number) => void;
  onNavigate: (step: number) => void;
  onError: (error: Error) => void;
}

interface FindingsOverlayProps extends Omit<VideoResultPlayerProps, "onError"> {
  onShownFrame: (frame: number) => void;
}

const PLAYBACK_REPORT_MILLISECONDS = 150;
const TIMELINE = { indexBase: IndexBase.ZERO };

function isLoaded(snapshot: PlayerSnapshot): boolean {
  return snapshot.timeline !== null && snapshot.state !== PlaybackState.IDLE && snapshot.state !== PlaybackState.LOADING;
}

function FindingsOverlay({
  current,
  frame,
  results,
  listed,
  highlighted,
  options,
  classColors,
  onSeek,
  onSelectFinding,
  onNavigate,
  onShownFrame,
}: FindingsOverlayProps) {
  const controller: PlayerController = usePlayerController();
  const reportedFrame = useRef<number | null>(current.frame);
  const lastReportAt = useRef(0);
  const width = current.width ?? 1;
  const height = current.height ?? 1;
  const painter = useMemo(() => new FindingPainter(width, height, options, classColors), [width, height, options, classColors]);

  const sceneAt = useCallback(
    (timeId: number): FrameScene | null => {
      const shown = results?.resultAt(timeId) ?? (frame !== null && frame.frame === timeId ? frame : null);
      if (shown === null || !shown.is_recognized) return null;
      return {
        frame: shown,
        listedIndices: listed === null ? null : (listed.get(pictureKeyOf(shown.path, shown.result_frame)) ?? new Set()),
        highlightedIndex: highlighted !== null && highlighted.frame === shown.result_frame ? highlighted.index : null,
      };
    },
    [results, frame, listed, highlighted],
  );

  const draw = useCallback(
    ({ surface, transform, frame: presented }: FrameDrawContext) => {
      const scene = sceneAt(presented.timeId);
      if (scene !== null) painter.draw(surface, transform, scene);
    },
    [painter, sceneAt],
  );

  const onClick = useCallback(
    (pointer: FramePointer): boolean => {
      const scene = sceneAt(pointer.frame.timeId);
      if (scene === null) return false;
      const index = painter.findingAt(pointer.framePoint, scene);
      if (index === null) return false;
      controller.pause();
      onSelectFinding(scene.frame.result_frame, index);
      return true;
    },
    [controller, painter, sceneAt, onSelectFinding],
  );

  useEffect(() => {
    let previousState: PlaybackState | null = null;
    let isPositioned = false;
    let isPositioning = false;
    let isDisposed = false;
    const report = (snapshot: PlayerSnapshot) => {
      const timeId = snapshot.timeId;
      if (isDisposed || timeId === null || !isLoaded(snapshot)) return;
      if (!isPositioned) {
        isPositioned = true;
        const target = reportedFrame.current;
        if (target !== null && target !== timeId) {
          isPositioning = true;
          void controller
            .settledFrame()
            .then(() => controller.seekToTimeId(reportedFrame.current ?? target))
            .catch(() => undefined)
            .finally(() => {
              isPositioning = false;
              report(controller.getSnapshot());
            });
        }
      }
      if (isPositioning) return;
      const isPlaying = snapshot.state === PlaybackState.PLAYING;
      const wasPlaying = previousState === PlaybackState.PLAYING;
      previousState = snapshot.state;
      if (isPlaying) {
        const now = Date.now();
        if (now - lastReportAt.current >= PLAYBACK_REPORT_MILLISECONDS) {
          lastReportAt.current = now;
          onShownFrame(timeId);
        }
        return;
      }
      onShownFrame(timeId);
      if (timeId === reportedFrame.current && !wasPlaying) return;
      reportedFrame.current = timeId;
      onSeek(timeId, wasPlaying);
    };
    report(controller.getSnapshot());
    const unsubscribe = controller.subscribe(() => report(controller.getSnapshot()));
    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [controller, onSeek, onShownFrame]);

  useEffect(() => {
    const target = current.frame;
    if (target === null || target === reportedFrame.current) return;
    reportedFrame.current = target;
    const snapshot = controller.getSnapshot();
    if (!isLoaded(snapshot)) return;
    if (snapshot.state === PlaybackState.PLAYING) controller.pause();
    if (snapshot.timeId !== target) void controller.seekToTimeId(target);
  }, [controller, current.frame]);

  usePlayerShortcut("PageUp", () => onNavigate(-1));
  usePlayerShortcut("PageDown", () => onNavigate(1));

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const onPointerMove = useCallback(
    (pointer: FramePointer) => {
      const scene = sceneAt(pointer.frame.timeId);
      setCursor(scene !== null && painter.findingAt(pointer.framePoint, scene) !== null ? "pointer" : undefined);
    },
    [sceneAt, painter],
  );

  return <FrameCanvas draw={draw} onClick={onClick} onPointerMove={onPointerMove} cursor={cursor} />;
}

export function VideoResultPlayer(props: VideoResultPlayerProps) {
  const { current, frame, results, listed, options, classColors, onSelectFinding, onError } = props;
  const [shownFrame, setShownFrame] = useState<number | null>(current.frame);
  const source = useMemo(() => api.videoUrl(current.path, current.version), [current.path, current.version]);
  const shown = shownFrame === null ? null : (results?.resultAt(shownFrame) ?? (frame?.frame === shownFrame ? frame : null));
  const listedIndices =
    shown === null || listed === null ? null : (listed.get(pictureKeyOf(shown.path, shown.result_frame)) ?? new Set<number>());
  const resultNote =
    shown === null || !shown.is_recognized
      ? "not recognized"
      : shown.result_frame === shownFrame
        ? `${visibleInstancesOf(shown, listedIndices, options).length} findings`
        : `result of #${shown.result_frame}`;

  return (
    <div className="video-result-player">
      <VideoPlayer
        key={source}
        source={source}
        timeline={TIMELINE}
        framesPerSecond={current.fps ?? undefined}
        onError={onError}
        className="ovir-player"
      >
        <FindingsOverlay {...props} onShownFrame={setShownFrame} />
        <div className="video-hud">
          {current.name} ({current.width}×{current.height}) · {resultNote}
          {shown !== null && shown.outdated !== null && (
            <span style={{ color: "var(--warning)" }} title={`Recognized with other classes: ${shown.outdated}`}>
              {" "}
              ⚠ outdated
            </span>
          )}
        </div>
      </VideoPlayer>
      {shown !== null && (
        <ScorePanel
          frame={shown}
          listedIndices={listedIndices}
          options={options}
          classColors={classColors}
          onSelectFinding={(index) => onSelectFinding(shown.result_frame, index)}
        />
      )}
    </div>
  );
}
