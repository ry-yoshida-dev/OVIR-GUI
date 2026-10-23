import { PlaybackState, type PlayerController, type ReleaseHold } from "@video-player-ui/core";
import { usePlayerController } from "@video-player-ui/web";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
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
 * frame, and its rate follows the recognition speed so it rarely has to stop. Waiting holds the player in its playing
 * state, so pausing stops it as during normal playback; pausing also ends the hold.
 */
export function LivePlaybackGate({ live, results, framesPerSecond, frameCount }: LivePlaybackGateProps) {
  const controller: PlayerController = usePlayerController();
  const pace = useRef(new LivePace());
  const appliedRate = useRef(1);
  const releaseHold = useRef<ReleaseHold | null>(null);
  const isEvaluating = useRef(false);
  const [status, setStatus] = useState<LiveStatus | null>(null);

  const applyRate = useCallback(
    (rate: number) => {
      if (Math.abs(rate - appliedRate.current) < RATE_TOLERANCE) return;
      appliedRate.current = rate;
      controller.setPlaybackRate(rate);
    },
    [controller],
  );

  const release = useCallback(() => {
    const releaseGateHold = releaseHold.current;
    releaseHold.current = null;
    if (releaseGateHold !== null) void releaseGateHold();
  }, []);

  const update = () => {
    const run = live;
    const index = results;
    const fps = framesPerSecond;
    const count = frameCount;
    const snapshot = controller.getSnapshot();
    const timeId = snapshot.timeId;
    if (!snapshot.isHeld) releaseHold.current = null;
    if (run === null || !run.isRunning || index === null) {
      release();
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
      if (releaseHold.current === null) {
        if (!isComplete && lead <= 0) releaseHold.current = controller.hold();
      } else {
        const resumeLead = Math.max(2 * run.frameStep, Math.round(fps * RESUME_LEAD_SECONDS * rate));
        if (isComplete || lead >= resumeLead) release();
      }
    }
    setStatus((previous) => {
      const isWaiting = releaseHold.current !== null;
      const roundedRate = Math.round(appliedRate.current * 100) / 100;
      if (
        previous !== null &&
        previous.isWaiting === isWaiting &&
        previous.frontier === frontier &&
        previous.rate === roundedRate
      ) {
        return previous;
      }
      return { isWaiting, frontier, rate: roundedRate };
    });
  };

  const evaluate = useEffectEvent(() => {
    if (isEvaluating.current) return;
    isEvaluating.current = true;
    try {
      update();
    } finally {
      isEvaluating.current = false;
    }
  });

  useEffect(() => controller.subscribe(() => evaluate()), [controller]);

  const liveSerial = live?.serial ?? null;
  useEffect(() => {
    if (liveSerial === null) return;
    pace.current.reset();
    evaluate();
  }, [liveSerial]);

  useEffect(() => {
    if (live === null || !live.isRunning || results === null) {
      evaluate();
      return;
    }
    const timeId = controller.getSnapshot().timeId;
    const frontier = timeId === null ? null : results.coveredUntil(timeId, live.frameStep);
    if (frontier !== null) pace.current.record(frontier, Date.now());
    evaluate();
  }, [live, results, controller]);

  useEffect(
    () => () => {
      release();
      controller.setPlaybackRate(1);
    },
    [controller, release],
  );

  if (status === null) return null;
  return (
    <div className={`live-badge${status.isWaiting ? " waiting" : ""}`} role="status">
      {status.isWaiting ? (
        <>
          <span className="spinner" /> Inferring ahead…
        </>
      ) : (
        "● LIVE"
      )}
      <span className="muted">
        {status.frontier === null ? " · waiting for the first result" : ` · inferred to #${status.frontier}`}
        {status.rate < 1 ? ` · ×${status.rate.toFixed(2)}` : ""}
      </span>
    </div>
  );
}
