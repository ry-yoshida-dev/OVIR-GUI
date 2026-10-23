import { api } from "../api/client";
import type { FramePayload } from "../api/types";
import { useAsyncResource } from "./useAsyncResource";

/**
 * Loads the result shown on the current picture, reloading when the refresh token changes.
 */
export function useFramePayload(
  path: string | null,
  frame: number | null,
  refreshToken: string,
): FramePayload | null {
  return useAsyncResource(
    path === null ? null : JSON.stringify([path, frame, refreshToken]),
    () => api.frame(path ?? "", frame),
  );
}
