import { useCallback } from "react";
import { api } from "../api/client";
import type { CurrentPicture, InferenceModeValue } from "../api/types";
import type { PlaybackPosition } from "../lib/playbackPosition";
import type { RunAction } from "./useActionRunner";

interface InferOptions {
  mode: InferenceModeValue;
  current: CurrentPicture | null;
  position: PlaybackPosition;
  runAction: RunAction;
  onLiveStarted: (path: string) => void;
}

/**
 * Starts inference in the chosen mode; inferring every sampled frame of a video starts from the shown frame and
 * plays along with it.
 */
export function useInfer({
  mode,
  current,
  position,
  runAction,
  onLiveStarted,
}: InferOptions): () => void {
  const currentPath = current?.path ?? null;
  const currentFrame = current?.frame ?? null;
  const isVideo = current?.kind === "video";
  const inferAll = useCallback(async () => {
    const startFrame = isVideo ? (position.current() ?? currentFrame) : null;
    const isStarted = await runAction((isSkippingApproved) =>
      api.runAll(isSkippingApproved, startFrame),
    );
    if (isStarted && isVideo && currentPath !== null)
      onLiveStarted(currentPath);
  }, [isVideo, position, currentFrame, currentPath, runAction, onLiveStarted]);
  return useCallback(() => {
    switch (mode) {
      case "all":
        void inferAll();
        break;
      case "shown":
        void runAction(api.run);
        break;
    }
  }, [mode, inferAll, runAction]);
}
