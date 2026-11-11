import { afterEach, describe, expect, it, vi } from "vitest";
import type { Finding, FrameInstance, FramePayload } from "@/api/types";
import { api } from "@/api/client";
import { MaskOutlineCache } from "@/domain/maskOutlineCache";

function instance(index: number, polygons: number[][]): FrameInstance {
  return {
    index,
    class_name: "car",
    matched_prompt: null,
    matched_template: null,
    confidence: 0.9,
    box: [0, 0, 10, 10],
    area: null,
    is_accepted: true,
    is_passing: true,
    polygons,
  };
}

function framePayload(findings: (Finding | FrameInstance)[]): FramePayload {
  return {
    path: "/pictures/a.png",
    frame: null,
    task: "segmentation",
    result_frame: null,
    is_recognized: true,
    is_exact: true,
    outdated: null,
    findings,
    scores: [],
    compared: null,
  };
}

describe("MaskOutlineCache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the outlines of each instance by its index", async () => {
    const label: Finding = { ...instance(2, []), box: null };
    const frame = vi.spyOn(api, "frame").mockResolvedValue(framePayload([instance(0, [[1, 2, 3, 4]]), instance(1, []), label]));
    const outlines = await new MaskOutlineCache().outlinesOf("/videos/a.mp4", 12, "result");
    expect(frame).toHaveBeenCalledWith("/videos/a.mp4", 12);
    expect([...outlines.entries()]).toEqual([
      [0, [[1, 2, 3, 4]]],
      [1, []],
    ]);
  });

  it("shares one request for the same picture and result", async () => {
    const frame = vi.spyOn(api, "frame").mockResolvedValue(framePayload([]));
    const cache = new MaskOutlineCache();
    const first = cache.outlinesOf("/pictures/a.png", null, "result");
    const second = cache.outlinesOf("/pictures/a.png", null, "result");
    expect(second).toBe(first);
    await first;
    expect(frame).toHaveBeenCalledTimes(1);
  });

  it("loads again for another frame or another result", async () => {
    const frame = vi.spyOn(api, "frame").mockResolvedValue(framePayload([]));
    const cache = new MaskOutlineCache();
    await cache.outlinesOf("/videos/a.mp4", 1, "result");
    await cache.outlinesOf("/videos/a.mp4", 2, "result");
    await cache.outlinesOf("/videos/a.mp4", 1, "newer");
    expect(frame).toHaveBeenCalledTimes(3);
  });

  it("forgets a failed request so that the next call retries", async () => {
    const frame = vi
      .spyOn(api, "frame")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(framePayload([instance(0, [[1, 1]])]));
    const cache = new MaskOutlineCache();
    await expect(cache.outlinesOf("/pictures/a.png", null, "result")).rejects.toThrow("offline");
    const outlines = await cache.outlinesOf("/pictures/a.png", null, "result");
    expect(outlines.get(0)).toEqual([[1, 1]]);
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it("starts over once 512 pictures are held", async () => {
    const frame = vi.spyOn(api, "frame").mockResolvedValue(framePayload([]));
    const cache = new MaskOutlineCache();
    for (let picture = 0; picture < 512; picture += 1) await cache.outlinesOf(`/pictures/${picture}.png`, null, "result");
    await cache.outlinesOf("/pictures/0.png", null, "result");
    expect(frame).toHaveBeenCalledTimes(512);
    await cache.outlinesOf("/pictures/512.png", null, "result");
    await cache.outlinesOf("/pictures/0.png", null, "result");
    expect(frame).toHaveBeenCalledTimes(514);
  });
});
