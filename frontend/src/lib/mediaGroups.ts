import type { MediaEntry, MediaKindValue } from "../api/types";
import type { SectionName } from "../hooks/useLayoutState";

export interface MediaGroup {
  kind: MediaKindValue;
  label: string;
  section: SectionName;
  entries: MediaEntry[];
}

const GROUP_ORDER: { kind: MediaKindValue; label: string; section: SectionName }[] = [
  { kind: "image", label: "Images", section: "image-media" },
  { kind: "video", label: "Videos", section: "video-media" },
];

export function groupMedia(media: MediaEntry[]): MediaGroup[] {
  return GROUP_ORDER.map(({ kind, label, section }) => ({
    kind,
    label,
    section,
    entries: media.filter((entry) => entry.kind === kind),
  })).filter((group) => group.entries.length > 0);
}

export function orderMedia(media: MediaEntry[]): MediaEntry[] {
  return groupMedia(media).flatMap((group) => group.entries);
}
