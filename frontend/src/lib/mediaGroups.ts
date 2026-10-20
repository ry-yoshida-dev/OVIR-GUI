import type { MediaEntry, MediaKindValue } from "../api/types";

export interface MediaGroup {
  kind: MediaKindValue;
  label: string;
  entries: MediaEntry[];
}

const GROUP_ORDER: { kind: MediaKindValue; label: string }[] = [
  { kind: "image", label: "Images" },
  { kind: "video", label: "Videos" },
];

export function groupMedia(media: MediaEntry[]): MediaGroup[] {
  return GROUP_ORDER.map(({ kind, label }) => ({
    kind,
    label,
    entries: media.filter((entry) => entry.kind === kind),
  })).filter((group) => group.entries.length > 0);
}

export function orderMedia(media: MediaEntry[]): MediaEntry[] {
  return groupMedia(media).flatMap((group) => group.entries);
}
