import { useEffect, useEffectEvent, useState } from "react";
import type { CurrentPicture, TimelinePayload } from "../api/types";
import { clamp } from "../lib/numbers";
import { formatSeconds } from "../lib/videoTime";
import { NumberField } from "./NumberField";
import { VideoTimeline } from "./VideoTimeline";

interface VideoControlsProps {
  current: CurrentPicture;
  frame: number;
  timeline: TimelinePayload | null;
  frameStep: number;
  isClassification: boolean;
  isPlaybackShown: boolean;
  onSeek: (frame: number, isFinal: boolean) => void;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const MINIMUM_PLAY_INTERVAL_MILLISECONDS = 60;

const TIME_FRACTION_DIGITS = 2;

export function VideoControls({
  current,
  frame,
  timeline,
  frameStep,
  isClassification: isTopClassBanded,
  isPlaybackShown,
  onSeek,
}: VideoControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playedPath, setPlayedPath] = useState(current.path);
  const frameCount = current.frame_count ?? 1;
  const fps = current.fps ?? 30;
  const lastFrame = frameCount - 1;

  if (playedPath !== current.path) {
    setPlayedPath(current.path);
    setIsPlaying(false);
  }

  const playNextSample = useEffectEvent(() => {
    const next = Math.floor(frame / frameStep) * frameStep + frameStep;
    if (next > lastFrame) {
      setIsPlaying(false);
      onSeek(lastFrame, true);
      return;
    }
    onSeek(next, true);
  });

  const interval = Math.max(MINIMUM_PLAY_INTERVAL_MILLISECONDS, (1000 * frameStep) / (fps * speed));
  useEffect(() => {
    if (!isPlaying || !isPlaybackShown) return;
    const timer = window.setInterval(() => playNextSample(), interval);
    return () => window.clearInterval(timer);
  }, [isPlaying, isPlaybackShown, interval]);

  const stepSampled = (direction: number) => {
    const base = Math.floor(frame / frameStep) * frameStep;
    const next = direction > 0 ? base + frameStep : frame > base ? base : base - frameStep;
    onSeek(clamp(next, 0, lastFrame), true);
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
          {formatSeconds(frame / fps, TIME_FRACTION_DIGITS)} / {formatSeconds(frameCount / fps, TIME_FRACTION_DIGITS)}
        </span>
        <span className="small muted">frame</span>
        <NumberField value={frame} minimum={0} maximum={lastFrame} step={1} width={76} onCommit={(value) => onSeek(Math.round(value), true)} />
        <span className="small muted">/ {lastFrame}</span>
      </div>
      )}
    </div>
  );
}
