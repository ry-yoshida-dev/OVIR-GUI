import { describe, expect, it } from "vitest";
import type { MediaEntry } from "@/api/types";
import { effectiveMediaSelection } from "@/domain/mediaSelection";

function mediaEntry(path: string): MediaEntry {
  return {
    path,
    name: path.split("/").at(-1) ?? path,
    kind: "image",
    state: "not_analyzed",
    expected_count: 0,
    recognized_count: 0,
    kept_count: 0,
    description: "",
    frame_count: null,
    fps: null,
  };
}

const media = ["/a.png", "/b.png", "/c.png"].map(mediaEntry);

describe("effectiveMediaSelection", () => {
  it("returns the checked paths in list order", () => {
    expect(effectiveMediaSelection(media, new Set(["/c.png", "/a.png"]), "/b.png")).toEqual([
      "/a.png",
      "/c.png",
    ]);
  });

  it("ignores checked paths that are not in the list", () => {
    expect(effectiveMediaSelection(media, new Set(["/gone.png", "/b.png"]), null)).toEqual(["/b.png"]);
  });

  it("falls back to the shown file when nothing is checked", () => {
    expect(effectiveMediaSelection(media, new Set(), "/b.png")).toEqual(["/b.png"]);
  });

  it("returns nothing when nothing is checked or shown", () => {
    expect(effectiveMediaSelection(media, new Set(), null)).toEqual([]);
  });

  it("returns nothing when only paths missing from the list are checked", () => {
    expect(effectiveMediaSelection(media, new Set(["/gone.png"]), "/a.png")).toEqual([]);
  });

  it("returns nothing for an empty list with checked paths", () => {
    expect(effectiveMediaSelection([], new Set(["/a.png"]), "/a.png")).toEqual([]);
  });
});
