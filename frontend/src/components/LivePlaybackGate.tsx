import { useCallback, useEffect, useRef, useState } from "react";
import { PlaybackState, type PlayerController } from "@video-player-ui/core";
import { usePlayerController } from "@video-player-ui/web";
import type { FrameResultIndex } from "../lib/frameResultIndex";
import { LivePace } from "../lib/livePace";

export interface LiveRun {
  serial: number;
  isRunning: boolean;
  frameStep: number;
}

interface LivePlaybackGateProps {
  live: LiveRun | null;
  results: FrameResultIndex | null;
  framesPerSecond: number;
  frameCount: number;
}

interface LiveStatus {
  isWaiting: boolean;
  frontier: number | null;
  rate: number;
}

const RESUME_LEAD_SECONDS = 0.5;
const RATE_TOLERANCE = 0.02;

/**
 * Keeps playback behind recognition while a video is being recognized: playback never passes the last recognized
 * frame, and its rate follows the recognition speed so it rarely has to stop.
 */
export function LivePlaybackGate({ live, results, framesPerSecond, frameCount }: LivePlaybackGateProps) {
  const controller: PlayerController = usePlayerController();
  const pace = useRef(new LivePace());
  const isGatePaused = useRef(false);
  const appliedRate = useRef(1);
  const latest = useRef({ live, results, framesPerSecond, frameCount });
  latest.current = { live, results, framesPerSecond, frameCount };
  const [status, setStatus] = useState<LiveStatus | null>(null);

  const applyRate = useCallback(
    (rate: number) => {
      if (Math.abs(rate - appliedRate.current) < RATE_TOLERANCE) return;
      appliedRate.current = rate;
      controller.setPlaybackRate(rate);
    },
    [controller],
  );

  const evaluate = useCallback(() => {
    const { live: run, results: index, framesPerSecond: fps, frameCount: count } = latest.current;
    const snapshot = controller.getSnapshot();
    const timeId = snapshot.timeId;
    if (run === null || !run.isRunning || index === null) {
      if (isGatePaused.current) {
        isGatePaused.current = false;
        void controller.play();
      }
      applyRate(1);
      setStatus(null);
      return;
    }
    if (timeId === null || snapshot.timeline === null) return;
    const frontier = index.coveredUntil(timeId, run.frameStep);
    const isComplete = frontier !== null && frontier + run.frameStep >= count - 1;
    const lead = frontier === null ? -1 : frontier - timeId;
    const rate = isComplete ? 1 : (pace.current.rateFor(fps) ?? 1);
    applyRate(rate);
    if (snapshot.state === PlaybackState.PLAYING) {
      if (!isComplete && lead <= 0) {
        isGatePaused.current = true;
        controller.pause();
      }
    } else if (isGatePaused.current) {
      const resumeLead = Math.max(2 * run.frameStep, Math.round(fps * RESUME_LEAD_SECONDS * rate));
      if (isComplete || lead >= resumeLead) {
        isGatePaused.current = false;
        void controller.play();
      }
    }
    setStatus((previous) => {
      const isWaiting = isGatePaused.current;
      const roundedRate = Math.round(appliedRate.current * 100) / 100;
      if (previous !== null && previous.isWaiting === isWaiting && previous.frontier === frontier && previous.rate === roundedRate) {
        return previous;
      }
      return { isWaiting, frontier, rate: roundedRate };
    });
  }, [controller, applyRate]);

  useEffect(() => controller.subscribe(evaluate), [controller, evaluate]);

  useEffect(() => {
    if (live === null) return;
    pace.current.reset();
    evaluate();
  }, [live?.serial, evaluate]);

  useEffect(() => {
    if (live === null || !live.isRunning || results === null) {
      evaluate();
      return;
    }
    const timeId = controller.getSnapshot().timeId;
    const frontier = timeId === null ? null : results.coveredUntil(timeId, live.frameStep);
    if (frontier !== null) pace.current.record(frontier, Date.now());
    evaluate();
  }, [live, results, controller, evaluate]);

  useEffect(
    () => () => {
      controller.setPlaybackRate(1);
    },
    [controller],
  );

  if (status === null) return null;
  return (
    <div className={`live-badge${status.isWaiting ? " waiting" : ""}`}>
      {status.isWaiting ? "◌ Inferring ahead…" : "● LIVE"}
      <span className="muted">
        {status.frontier === null ? " · waiting for the first result" : ` · inferred to #${status.frontier}`}
        {status.rate < 1 ? ` · ×${status.rate.toFixed(2)}` : ""}
      </span>
    </div>
  );
}
