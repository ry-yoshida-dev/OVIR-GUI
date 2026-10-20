import { useEffect, useRef, useState } from "react";
import type { CurrentPicture, TimelinePayload } from "../api/types";
import { NumberField } from "./NumberField";
import { VideoTimeline } from "./VideoTimeline";

interface VideoControlsProps {
  current: CurrentPicture;
  frame: number;
  timeline: TimelinePayload | null;
  frameStep: number;
  isClassification: boolean;
  isBusy: boolean;
  isPlaybackShown: boolean;
  onSeek: (frame: number, isFinal: boolean) => void;
  onFrameStepChange: (frameStep: number) => void;
  onRunVideo: () => void;
  onRunLive: (() => void) | null;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(2).padStart(5, "0")}`;
}

export function VideoControls({
  current,
  frame,
  timeline,
  frameStep,
  isClassification: isTopClassBanded,
  isBusy,
  isPlaybackShown,
  onSeek,
  onFrameStepChange,
  onRunVideo,
  onRunLive,
}: VideoControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const frameCount = current.frame_count ?? 1;
  const fps = current.fps ?? 30;
  const lastFrame = frameCount - 1;
  const recognized = timeline?.frames ?? [];

  useEffect(() => {
    if (!isPlaying || !isPlaybackShown) return;
    const interval = Math.max(60, (1000 * frameStep) / (fps * speed));
    const timer = window.setInterval(() => {
      const next = Math.floor(frameRef.current / frameStep) * frameStep + frameStep;
      if (next > lastFrame) {
        setIsPlaying(false);
        onSeek(lastFrame, true);
        return;
      }
      onSeek(next, true);
    }, interval);
    return () => window.clearInterval(timer);
  }, [isPlaying, isPlaybackShown, frameStep, fps, speed, lastFrame, onSeek]);

  useEffect(() => {
    setIsPlaying(false);
  }, [current.path]);

  const stepSampled = (direction: number) => {
    const base = Math.floor(frame / frameStep) * frameStep;
    const next = direction > 0 ? base + frameStep : frame > base ? base : base - frameStep;
    onSeek(Math.min(lastFrame, Math.max(0, next)), true);
  };

  const jumpToFound = (direction: number) => {
    if (timeline === null) return;
    const positions = recognized.map((_, position) => position);
    const hasFinding = (position: number) =>
      isTopClassBanded
        ? timeline.top_classes[position] !== null
        : timeline.classes.some((entry) => (entry.values[position] ?? 0) > 0);
    const candidates = direction > 0 ? positions : [...positions].reverse();
    for (const position of candidates) {
      const index = recognized[position] ?? 0;
      if ((direction > 0 ? index > frame : index < frame) && hasFinding(position)) {
        onSeek(index, true);
        return;
      }
    }
  };

  return (
    <div className="video-controls">
      <VideoTimeline
        timeline={timeline}
        frameCount={frameCount}
        frame={frame}
        isTopClassBanded={isTopClassBanded}
        onSeek={onSeek}
      />
      {isPlaybackShown && (
      <div className="row">
        <button className="icon" onClick={() => onSeek(0, true)} title="First frame (Home)">
          ⏮
        </button>
        <button className="icon" onClick={() => stepSampled(-1)} title="Previous sampled frame">
          ◀◀
        </button>
        <button className="icon primary" onClick={() => setIsPlaying((playing) => !playing)} title="Play the sampled frames">
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button className="icon" onClick={() => stepSampled(1)} title="Next sampled frame">
          ▶▶
        </button>
        <button className="icon" onClick={() => onSeek(lastFrame, true)} title="Last frame (End)">
          ⏭
        </button>
        <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} title="Playback speed">
          {SPEEDS.map((value) => (
            <option key={value} value={value}>
              {value}×
            </option>
          ))}
        </select>
        <span className="mono small">
          {formatTime(frame / fps)} / {formatTime(frameCount / fps)}
        </span>
        <span className="small muted">frame</span>
        <NumberField value={frame} minimum={0} maximum={lastFrame} step={1} width={76} onCommit={(value) => onSeek(Math.round(value), true)} />
        <span className="small muted">/ {lastFrame}</span>
      </div>
      )}
      <div className="row">
        <button className="small" onClick={() => jumpToFound(-1)} disabled={recognized.length === 0} title="Previous recognized frame with a kept finding">
          ◁ Found
        </button>
        <button className="small" onClick={() => jumpToFound(1)} disabled={recognized.length === 0} title="Next recognized frame with a kept finding">
          Found ▷
        </button>
        <span className="grow" />
        <span className="small muted" title="Recognize every Nth frame">
          every
        </span>
        <NumberField value={frameStep} minimum={1} maximum={100000} step={1} width={60} onCommit={(value) => onFrameStepChange(Math.round(value))} />
        <span className="small muted">frames ({(frameStep / fps).toFixed(2)} s)</span>
        <button className="small" disabled={isBusy} onClick={onRunVideo} title="Recognize every sampled frame of this video now">
          Run Video
        </button>
        {onRunLive !== null && (
          <button
            className="small primary"
            disabled={isBusy}
            onClick={onRunLive}
            title="Recognize from the shown frame onward and play the video as results arrive; playback slows down to stay behind recognition"
          >
            ▶ Run Live
          </button>
        )}
      </div>
    </div>
  );
}
