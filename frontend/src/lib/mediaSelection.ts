import type { MediaEntry } from "../api/types";

/**
 * The files an action on the media list applies to: the checked ones in list order, else the shown one.
 */
export function effectiveMediaSelection(
  media: MediaEntry[],
  checkedPaths: ReadonlySet<string>,
  currentPath: string | null,
): string[] {
  if (checkedPaths.size > 0) return media.map((entry) => entry.path).filter((path) => checkedPaths.has(path));
  return currentPath === null ? [] : [currentPath];
}
