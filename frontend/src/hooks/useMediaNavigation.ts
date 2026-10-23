import { useCallback, useMemo } from "react";
import type { MediaEntry } from "../api/types";
import { orderMedia } from "../lib/mediaGroups";
import { clamp } from "../lib/numbers";

export interface MediaNavigator {
  orderedMedia: MediaEntry[];
  currentMediaIndex: number;
  showMedia: (path: string) => void;
  navigate: (step: number) => void;
}

/**
 * Steps through the open media in the order they are listed, images first, clearing the row selection on the way.
 */
export function useMediaNavigation(
  media: MediaEntry[] | undefined,
  currentPath: string | null,
  show: (path: string, frame: number | null) => void,
  clearSelection: () => void,
): MediaNavigator {
  const orderedMedia = useMemo(() => orderMedia(media ?? []), [media]);
  const currentMediaIndex = orderedMedia.findIndex(
    (entry) => entry.path === currentPath,
  );
  const showMedia = useCallback(
    (path: string) => {
      clearSelection();
      show(path, null);
    },
    [clearSelection, show],
  );
  const navigate = useCallback(
    (step: number) => {
      const next =
        orderedMedia[
          clamp(currentMediaIndex + step, 0, orderedMedia.length - 1)
        ];
      if (next !== undefined && next.path !== currentPath) showMedia(next.path);
    },
    [orderedMedia, currentMediaIndex, currentPath, showMedia],
  );
  return { orderedMedia, currentMediaIndex, showMedia, navigate };
}
