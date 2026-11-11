import { describe, expect, it } from "vitest";
import type { MediaEntry, MediaKindValue } from "@/api/types";
import { groupMedia, orderMedia } from "@/domain/mediaGroups";

function mediaEntry(path: string, kind: MediaKindValue): MediaEntry {
  return {
    path,
    name: path,
    kind,
    state: "not_analyzed",
    expected_count: 0,
    recognized_count: 0,
    kept_count: 0,
    description: "",
    frame_count: kind === "video" ? 100 : null,
    fps: kind === "video" ? 30 : null,
  };
}

const clip = mediaEntry("/clip.mp4", "video");
const first = mediaEntry("/first.png", "image");
const movie = mediaEntry("/movie.mov", "video");
const second = mediaEntry("/second.jpg", "image");

describe("groupMedia", () => {
  it("puts images before videos, keeping list order inside each group", () => {
    const groups = groupMedia([clip, first, movie, second]);
    expect(groups.map((group) => [group.kind, group.label, group.section])).toEqual([
      ["image", "Images", "image-media"],
      ["video", "Videos", "video-media"],
    ]);
    expect(groups[0]?.entries).toEqual([first, second]);
    expect(groups[1]?.entries).toEqual([clip, movie]);
  });

  it("leaves out a kind with no files", () => {
    const groups = groupMedia([clip]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("video");
  });

  it("returns no groups for an empty list", () => {
    expect(groupMedia([])).toEqual([]);
  });
});

describe("orderMedia", () => {
  it("lists images first, then videos", () => {
    expect(orderMedia([clip, first, movie, second])).toEqual([first, second, clip, movie]);
  });

  it("returns an empty list for no media", () => {
    expect(orderMedia([])).toEqual([]);
  });
});
