import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { CurrentPicture } from "../api/types";
import type { LiveRun } from "../components/LivePlaybackGate";
import { clamp } from "../lib/numbers";
import { PlaybackPosition } from "../lib/playbackPosition";
import { formatSeconds } from "../lib/videoTime";
import type { Call } from "./useActionRunner";
import { useKeyedInstance } from "./useKeyedInstance";

interface FrameRequest {
  path: string;
  frame: number;
}

interface LiveRequest {
  path: string;
  serial: number;
  isBusySeen: boolean;
}

interface FollowRequest {
  path: string;
  serial: number;
  isFollowed: boolean;
}

interface PlaybackSyncOptions {
  serverCurrent: CurrentPicture | null;
  frameStep: number;
  isRecognitionRunning: boolean;
  isAutoInferenceRunning: boolean;
  call: Call;
}

export interface PlaybackSync {
  current: CurrentPicture | null;
  position: PlaybackPosition;
  live: LiveRun | null;
  isLiveRunning: boolean;
  show: (path: string, frame: number | null) => void;
  seek: (frame: number, isFinal: boolean) => void;
  follow: (frame: number, isStart: boolean) => void;
  stepFrame: (step: number) => void;
  startLive: (path: string) => void;
}

const SHOW_THROTTLE_MILLISECONDS = 150;
const FALLBACK_FRAMES_PER_SECOND = 30;
const TIMESTAMP_FRACTION_DIGITS = 3;

function timestampOf(frame: number, fps: number): string {
  return formatSeconds(frame / fps, TIMESTAMP_FRACTION_DIGITS);
}

/**
 * Keeps the shown picture in step with the server: frames picked in the browser show at once while the server
 * catches up, seeks during playback are throttled, and playback follows inference while it runs.
 */
export function usePlaybackSync({
  serverCurrent,
  frameStep,
  isRecognitionRunning,
  isAutoInferenceRunning,
  call,
}: PlaybackSyncOptions): PlaybackSync {
  const [pendingFrame, setPendingFrame] = useState<FrameRequest | null>(null);
  const [liveRequest, setLiveRequest] = useState<LiveRequest | null>(null);
  const [followRequest, setFollowRequest] = useState<FollowRequest | null>(
    null,
  );
  const liveSerial = useRef(0);
  const showTimer = useRef<number | undefined>(undefined);
  const lastShowAt = useRef(0);
  const isAutoInferenceRunningRef = useRef(isAutoInferenceRunning);

  useEffect(() => {
    isAutoInferenceRunningRef.current = isAutoInferenceRunning;
  }, [isAutoInferenceRunning]);

  useEffect(() => () => window.clearTimeout(showTimer.current), []);

  if (
    pendingFrame !== null &&
    serverCurrent !== null &&
    (serverCurrent.path !== pendingFrame.path ||
      serverCurrent.frame === pendingFrame.frame)
  )
    setPendingFrame(null);

  const current: CurrentPicture | null = useMemo(() => {
    if (serverCurrent === null) return null;
    if (
      pendingFrame === null ||
      pendingFrame.path !== serverCurrent.path ||
      serverCurrent.kind !== "video"
    ) {
      return serverCurrent;
    }
    return {
      ...serverCurrent,
      frame: pendingFrame.frame,
      timestamp: timestampOf(
        pendingFrame.frame,
        serverCurrent.fps ?? FALLBACK_FRAMES_PER_SECOND,
      ),
      is_sampled: pendingFrame.frame % frameStep === 0,
    };
  }, [serverCurrent, pendingFrame, frameStep]);
  const currentPath = current?.path ?? null;
  const position = useKeyedInstance(
    currentPath,
    () => new PlaybackPosition(),
  );

  if (liveRequest !== null) {
    if (liveRequest.path !== currentPath) setLiveRequest(null);
    else if (isRecognitionRunning && !liveRequest.isBusySeen)
      setLiveRequest({ ...liveRequest, isBusySeen: true });
    else if (!isRecognitionRunning && liveRequest.isBusySeen)
      setLiveRequest(null);
  }
  if (followRequest !== null && followRequest.path !== currentPath)
    setFollowRequest(null);

  const isInferAllLive =
    liveRequest !== null &&
    liveRequest.path === currentPath &&
    (isRecognitionRunning || !liveRequest.isBusySeen);
  const isPlaybackFollowed =
    followRequest !== null &&
    followRequest.path === currentPath &&
    followRequest.isFollowed &&
    isAutoInferenceRunning;
  const live = useMemo(() => {
    if (liveRequest !== null && liveRequest.path === currentPath)
      return {
        serial: liveRequest.serial,
        isRunning: isInferAllLive,
        frameStep,
      };
    if (followRequest !== null && followRequest.path === currentPath)
      return {
        serial: followRequest.serial,
        isRunning: isPlaybackFollowed,
        frameStep,
      };
    return null;
  }, [
    liveRequest,
    followRequest,
    currentPath,
    isInferAllLive,
    isPlaybackFollowed,
    frameStep,
  ]);

  const show = useCallback(
    (path: string, frame: number | null) => {
      window.clearTimeout(showTimer.current);
      if (frame !== null) setPendingFrame({ path, frame });
      lastShowAt.current = Date.now();
      void call(() => api.show(path, frame));
    },
    [call],
  );

  const showThrottled = useCallback(
    (path: string, frame: number, isPlaying: boolean, isFinal: boolean) => {
      setPendingFrame({ path, frame });
      window.clearTimeout(showTimer.current);
      const send = () => {
        lastShowAt.current = Date.now();
        void call(async () => {
          const reply = await api.show(path, frame, isPlaying);
          if (!isPlaying) return;
          setFollowRequest((request) =>
            request !== null && request.path === path
              ? { ...request, isFollowed: reply.is_following_playback }
              : request,
          );
        });
      };
      const elapsed = Date.now() - lastShowAt.current;
      if (isFinal || elapsed >= SHOW_THROTTLE_MILLISECONDS) send();
      else
        showTimer.current = window.setTimeout(
          send,
          SHOW_THROTTLE_MILLISECONDS - elapsed,
        );
    },
    [call],
  );

  const seek = useCallback(
    (frame: number, isFinal: boolean) => {
      if (currentPath === null) return;
      setFollowRequest(null);
      showThrottled(currentPath, frame, false, isFinal);
    },
    [currentPath, showThrottled],
  );

  const follow = useCallback(
    (frame: number, isStart: boolean) => {
      if (currentPath === null) return;
      const path = currentPath;
      liveSerial.current += 1;
      const serial = liveSerial.current;
      setFollowRequest((request) =>
        request !== null && request.path === path
          ? request
          : { path, serial, isFollowed: isAutoInferenceRunningRef.current },
      );
      showThrottled(path, frame, true, isStart);
    },
    [currentPath, showThrottled],
  );

  const stepFrame = useCallback(
    (step: number) => {
      if (
        current === null ||
        current.frame === null ||
        current.frame_count === null
      )
        return;
      seek(clamp(current.frame + step, 0, current.frame_count - 1), true);
    },
    [current, seek],
  );

  const startLive = useCallback((path: string) => {
    liveSerial.current += 1;
    setLiveRequest({ path, serial: liveSerial.current, isBusySeen: false });
  }, []);

  return {
    current,
    position,
    live,
    isLiveRunning: isInferAllLive || isPlaybackFollowed,
    show,
    seek,
    follow,
    stepFrame,
    startLive,
  };
}
