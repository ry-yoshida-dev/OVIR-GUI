import { api } from "../api/client";
import type { TimelinePayload } from "../api/types";
import { useAsyncResource } from "./useAsyncResource";

const TIMELINE_DEBOUNCE_MILLISECONDS = 120;

/**
 * Loads the inference marks under the seek bar of the current video.
 */
export function useTimeline(
  videoPath: string | null,
  refreshToken: string,
): TimelinePayload | null {
  return useAsyncResource(
    videoPath === null ? null : JSON.stringify([videoPath, refreshToken]),
    () => api.timeline(videoPath ?? ""),
    { debounceMilliseconds: TIMELINE_DEBOUNCE_MILLISECONDS },
  );
}
