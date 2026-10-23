import { useMemo, useState } from "react";
import type {
  CurrentPicture,
  FramePayload,
  MediaEntry,
  ResultsPayload,
  TimelinePayload,
  WorkspaceState,
} from "../api/types";
import type { FrameResultIndex } from "../lib/frameResultIndex";
import type { PlaybackPosition } from "../lib/playbackPosition";
import { pictureKeyOf } from "../lib/resultTable";
import type { ReviewFilter } from "../lib/reviewFilter";
import { useFramePayload } from "./useFramePayload";
import { useTimeline } from "./useTimeline";
import { useVideoResults } from "./useVideoResults";

interface ShownResultsOptions {
  state: WorkspaceState | null;
  results: ResultsPayload | null;
  resultsVersion: number;
  current: CurrentPicture | null;
  isLiveRunning: boolean;
  position: PlaybackPosition;
  draftFilter: ReviewFilter | null;
}

export interface ShownResults {
  markedResults: ResultsPayload | null;
  markedFramePayload: FramePayload | null;
  resultPictureKey: string | null;
  timeline: TimelinePayload | null;
  chartedVideo: MediaEntry | null;
  chartedVideoResults: FrameResultIndex | null;
  isChartedVideoCurrent: boolean;
}

/**
 * Loads the results shown for the current picture and for the charted video, the current one or else the last
 * video shown, marked with the review thresholds being dragged.
 */
export function useShownResults({
  state,
  results,
  resultsVersion,
  current,
  isLiveRunning,
  position,
  draftFilter,
}: ShownResultsOptions): ShownResults {
  const [lastVideoPath, setLastVideoPath] = useState<string | null>(null);
  const currentPath = current?.path ?? null;
  const isVideo = current?.kind === "video";
  if (isVideo && currentPath !== null && lastVideoPath !== currentPath)
    setLastVideoPath(currentPath);

  const frameRefreshToken = `${state?.shown_profile_key}:${state?.compared_profile_key}:${JSON.stringify(state?.thresholds)}:${resultsVersion}:${state?.status.serial}`;
  const framePayload = useFramePayload(
    currentPath,
    current?.frame ?? null,
    frameRefreshToken,
  );
  const timeline = useTimeline(
    isVideo ? currentPath : null,
    `${state?.shown_profile_key}:${JSON.stringify(state?.thresholds)}:${resultsVersion}:${state?.sampling.frame_step}:${state?.classes.length}`,
  );

  const chartedVideo: MediaEntry | null = useMemo(() => {
    const videos = state?.media.filter((entry) => entry.kind === "video") ?? [];
    const preferredPath = isVideo ? currentPath : lastVideoPath;
    return (
      videos.find((entry) => entry.path === preferredPath) ?? videos[0] ?? null
    );
  }, [state?.media, isVideo, currentPath, lastVideoPath]);
  const chartedVideoPath = chartedVideo?.path ?? null;
  const videoResults = useVideoResults({
    videoPath: chartedVideoPath,
    currentPath,
    refreshToken: frameRefreshToken,
    isLiveRunning,
    frameStep: state?.sampling.frame_step ?? 1,
    position,
  });
  const chartedVideoResults = useMemo(() => {
    if (videoResults === null || videoResults.path !== chartedVideoPath)
      return null;
    return draftFilter === null
      ? videoResults.index
      : draftFilter.markedVideo(videoResults.index);
  }, [videoResults, chartedVideoPath, draftFilter]);

  const markedResults = useMemo(
    () =>
      draftFilter === null || results === null
        ? results
        : draftFilter.markedResults(results),
    [draftFilter, results],
  );
  const markedFramePayload = useMemo(
    () =>
      draftFilter === null || framePayload === null
        ? framePayload
        : draftFilter.markedFrame(framePayload),
    [draftFilter, framePayload],
  );

  return {
    markedResults,
    markedFramePayload,
    resultPictureKey:
      framePayload === null || framePayload.path !== currentPath
        ? null
        : pictureKeyOf(framePayload.path, framePayload.result_frame),
    timeline,
    chartedVideo,
    chartedVideoResults,
    isChartedVideoCurrent:
      chartedVideoPath !== null && chartedVideoPath === currentPath,
  };
}
