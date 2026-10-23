import { useState } from "react";
import { api } from "../api/client";
import type { CurrentPicture } from "../api/types";
import type { Call } from "./useActionRunner";

export interface VideoPlayerFallback {
  isVideoPlayerUsed: boolean;
  onVideoPlayerFailed: (error: Error) => void;
}

/**
 * Plays videos in the browser player while it can, falling back to frames decoded by the server once a source
 * fails, after asking the server to prepare a playable copy.
 */
export function useVideoPlayerFallback(
  current: CurrentPicture | null,
  isDrawing: boolean,
  call: Call,
  report: (text: string) => void,
): VideoPlayerFallback {
  const [unplayableSources, setUnplayableSources] = useState<
    ReadonlySet<string>
  >(new Set());
  const currentPath = current?.path ?? null;
  const playback = current?.playback ?? "none";
  const playedSource = `${currentPath}|${playback}`;
  return {
    isVideoPlayerUsed:
      current?.kind === "video" &&
      currentPath !== null &&
      playback !== "preparing" &&
      !unplayableSources.has(playedSource) &&
      !isDrawing,
    onVideoPlayerFailed: (error) => {
      if (currentPath === null) return;
      const path = currentPath;
      setUnplayableSources((sources) => new Set([...sources, playedSource]));
      if (playback === "none") {
        void call(() => api.preparePlayback(path));
        return;
      }
      report(
        `The browser cannot play ${current?.name ?? path} (${error.message}); showing frames decoded by the server.`,
      );
    },
  };
}
