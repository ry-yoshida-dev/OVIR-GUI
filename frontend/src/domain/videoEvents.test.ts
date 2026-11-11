import { describe, expect, it } from "vitest";
import type { Finding, FramePayload } from "@/api/types";
import { VideoEventBuilder } from "@/domain/videoEvents";

function finding(className: string, overrides: Partial<Finding> = {}): Finding {
  return {
    index: 0,
    class_name: className,
    matched_prompt: null,
    matched_template: null,
    confidence: 0.5,
    box: null,
    area: null,
    is_accepted: true,
    is_passing: true,
    ...overrides,
  };
}

function frameAt(frame: number | null, findings: Finding[], overrides: Partial<FramePayload> = {}): FramePayload {
  return {
    path: "/videos/a.mp4",
    frame,
    task: "detection",
    result_frame: frame,
    is_recognized: true,
    is_exact: true,
    outdated: null,
    findings,
    scores: [],
    compared: null,
    ...overrides,
  };
}

function spansOf(frames: FramePayload[], frameCount: number, allowedMissCount: number): [string, number, number, number][] {
  return new VideoEventBuilder(frames, frameCount, allowedMissCount)
    .build()
    .events.map((event) => [event.className, event.startFrame, event.endFrame, event.shownEndFrame]);
}

describe("VideoEventBuilder", () => {
  it("summarizes a video without recognized frames as empty", () => {
    expect(new VideoEventBuilder([], 100, 0).build()).toEqual({
      tracks: [],
      events: [],
      sampleFrames: [],
      recognizedCount: 0,
    });
  });

  it("skips frames that were not recognized or have no frame number", () => {
    const summary = new VideoEventBuilder(
      [frameAt(0, []), frameAt(10, [], { is_recognized: false }), frameAt(null, []), frameAt(20, [])],
      30,
      0,
    ).build();
    expect(summary.sampleFrames).toEqual([0, 20]);
    expect(summary.recognizedCount).toBe(2);
  });

  it("joins consecutive samples of a class into one event shown until the next sample", () => {
    const frames = [frameAt(0, [finding("person")]), frameAt(10, [finding("person")]), frameAt(20, [])];
    const summary = new VideoEventBuilder(frames, 30, 0).build();
    expect(summary.events).toEqual([
      {
        key: "person@0",
        className: "person",
        startFrame: 0,
        endFrame: 10,
        shownEndFrame: 20,
        peakFrame: 0,
        peakConfidence: 0.5,
        maximumCount: 1,
        sampleCount: 2,
      },
    ]);
  });

  it("shows an event on the last sample until the end of the video", () => {
    expect(spansOf([frameAt(0, []), frameAt(10, [finding("person")])], 30, 0)).toEqual([["person", 10, 10, 30]]);
  });

  it("keeps one event across misses up to the allowed count", () => {
    const frames = [
      frameAt(0, [finding("person")]),
      frameAt(10, []),
      frameAt(20, []),
      frameAt(30, [finding("person")]),
    ];
    expect(spansOf(frames, 40, 2)).toEqual([["person", 0, 30, 40]]);
  });

  it("splits events after more misses than allowed", () => {
    const frames = [
      frameAt(0, [finding("person")]),
      frameAt(10, []),
      frameAt(20, []),
      frameAt(30, [finding("person")]),
    ];
    expect(spansOf(frames, 40, 1)).toEqual([
      ["person", 0, 0, 10],
      ["person", 30, 30, 40],
    ]);
  });

  it("treats a negative allowed miss count as none", () => {
    const frames = [frameAt(0, [finding("person")]), frameAt(10, []), frameAt(20, [finding("person")])];
    expect(spansOf(frames, 30, -3)).toEqual([
      ["person", 0, 0, 10],
      ["person", 20, 20, 30],
    ]);
  });

  it("counts only accepted findings above the class minimum", () => {
    const frames = [
      frameAt(0, [finding("person", { is_accepted: false }), finding("car", { is_passing: false })]),
    ];
    const summary = new VideoEventBuilder(frames, 10, 0).build();
    expect(summary.events).toEqual([]);
    expect(summary.tracks).toEqual([]);
  });

  it("records the most found at once and the most confident sample", () => {
    const frames = [
      frameAt(0, [finding("person", { confidence: 0.4 })]),
      frameAt(10, [finding("person", { confidence: 0.9 }), finding("person", { confidence: 0.3 })]),
      frameAt(20, [finding("person", { confidence: 0.9 })]),
    ];
    const [event] = new VideoEventBuilder(frames, 30, 0).build().events;
    expect(event?.maximumCount).toBe(2);
    expect(event?.peakConfidence).toBe(0.9);
    expect(event?.peakFrame).toBe(10);
    expect(event?.sampleCount).toBe(3);
  });

  it("builds a count track per class with its events and shown length", () => {
    const frames = [
      frameAt(0, [finding("person"), finding("person")]),
      frameAt(10, []),
      frameAt(20, [finding("person"), finding("car")]),
    ];
    const summary = new VideoEventBuilder(frames, 30, 0).build();
    expect(summary.tracks).toEqual([
      { className: "person", counts: [2, 0, 1], peakCount: 2, keptSampleCount: 2, eventCount: 2, totalFrames: 20 },
      { className: "car", counts: [0, 0, 1], peakCount: 1, keptSampleCount: 1, eventCount: 1, totalFrames: 10 },
    ]);
  });

  it("orders events by start frame, then by class name", () => {
    const frames = [frameAt(0, [finding("person"), finding("car")]), frameAt(10, [finding("bus")])];
    expect(spansOf(frames, 20, 0).map(([className, startFrame]) => `${className}@${startFrame}`)).toEqual([
      "car@0",
      "person@0",
      "bus@10",
    ]);
  });

  it("orders tracks by shown length, then by peak count, then by class name", () => {
    const frames = [
      frameAt(0, [finding("dog"), finding("cat"), finding("cat"), finding("bird")]),
      frameAt(10, [finding("ant")]),
    ];
    const summary = new VideoEventBuilder(frames, 20, 0).build();
    expect(summary.tracks.map((track) => track.className)).toEqual(["cat", "ant", "bird", "dog"]);
  });
});
