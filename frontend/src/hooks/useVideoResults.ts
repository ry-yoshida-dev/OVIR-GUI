import { api } from "../api/client";
import type { VideoFramesPayload } from "../api/types";
import { FrameResultIndex } from "../lib/frameResultIndex";
import type { PlaybackPosition } from "../lib/playbackPosition";
import { useAccumulatedResource } from "./useAsyncResource";

export interface VideoResults {
  path: string;
  index: FrameResultIndex;
}

interface LoadedFrames {
  payload: VideoFramesPayload;
  isIncremental: boolean;
}

interface VideoResultsOptions {
  videoPath: string | null;
  currentPath: string | null;
  refreshToken: string;
  isLiveRunning: boolean;
  frameStep: number;
  position: PlaybackPosition;
}

const VIDEO_RESULTS_DEBOUNCE_MILLISECONDS = 200;
const LIVE_RESULTS_DEBOUNCE_MILLISECONDS = 30;
const LIVE_FETCH_SAMPLES = 120;

/**
 * Loads the results of every inferred frame of a video; while a live run plays it, only the frames just ahead of
 * playback are loaded and merged into those known.
 */
export function useVideoResults({
  videoPath,
  currentPath,
  refreshToken,
  isLiveRunning,
  frameStep,
  position,
}: VideoResultsOptions): VideoResults | null {
  const isIncrementalFrom = (known: VideoResults | null): known is VideoResults =>
    isLiveRunning &&
    videoPath === currentPath &&
    known !== null &&
    known.path === videoPath;

  return useAccumulatedResource<LoadedFrames, VideoResults>(
    videoPath === null
      ? null
      : JSON.stringify([
          videoPath,
          currentPath,
          refreshToken,
          isLiveRunning,
          frameStep,
        ]),
    async (known) => {
      const path = videoPath ?? "";
      if (!isIncrementalFrom(known))
        return { payload: await api.videoFrames(path), isIncremental: false };
      const shownFrame = position.current() ?? 0;
      const afterFrame =
        known.index.coveredUntil(shownFrame, frameStep) ?? shownFrame - 1;
      const payload = await api.videoFrames(path, {
        afterFrame,
        untilFrame: afterFrame + frameStep * LIVE_FETCH_SAMPLES,
      });
      return { payload, isIncremental: true };
    },
    {
      debounceMilliseconds: (known) =>
        isIncrementalFrom(known)
          ? LIVE_RESULTS_DEBOUNCE_MILLISECONDS
          : VIDEO_RESULTS_DEBOUNCE_MILLISECONDS,
      accumulate: ({ payload, isIncremental }, previous) =>
        isIncremental && previous !== null && previous.path === payload.path
          ? { path: payload.path, index: previous.index.merged(payload) }
          : { path: payload.path, index: new FrameResultIndex(payload) },
    },
  );
}
