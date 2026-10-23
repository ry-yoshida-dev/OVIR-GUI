import { useEffect } from "react";
import { api } from "../api/client";
import { useEmbedBridge } from "./useEmbedBridge";

/**
 * Lets a parent page that embeds the app open, show and close media and read results, and tells it what is shown.
 */
export function useEmbedding(
  shownPath: string | null,
  shownFrame: number | null,
): void {
  const { isEmbedded, notify } = useEmbedBridge({
    open: async (paths, shownPathRequest) => {
      await api.openPaths(paths);
      const onlyPath = paths.length === 1 ? (paths[0] ?? null) : null;
      if (shownPathRequest !== null) {
        await api.show(shownPathRequest, null);
      } else if (onlyPath !== null) {
        await api.show(onlyPath, null).catch(() => undefined);
      }
    },
    show: async (path, frame) => {
      await api.show(path, frame);
    },
    close: async (paths) => {
      await api.closeMedia(paths);
    },
    results: (paths) => api.resultDocument(paths),
  });

  useEffect(() => {
    if (isEmbedded)
      notify({
        type: "ovir-gui:current-changed",
        path: shownPath,
        frame: shownFrame,
      });
  }, [isEmbedded, notify, shownPath, shownFrame]);
}
