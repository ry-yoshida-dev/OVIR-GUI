import type { FramePayload } from "../api/types";

export interface ClassSample {
  frame: number;
  nextFrame: number;
  count: number;
  confidence: number;
}

export interface ClassTrack {
  className: string;
  samples: ClassSample[];
  sampleCount: number;
  eventCount: number;
  totalFrames: number;
}

export interface VideoEvent {
  key: string;
  className: string;
  startFrame: number;
  endFrame: number;
  shownEndFrame: number;
  peakFrame: number;
  peakConfidence: number;
  maximumCount: number;
  sampleCount: number;
}

export interface VideoEventSummary {
  tracks: ClassTrack[];
  events: VideoEvent[];
  recognizedCount: number;
}

interface OpenEvent {
  event: VideoEvent;
  missedCount: number;
}

/**
 * Turns the per-frame findings of a video into one track per class and the spans where each class keeps being found.
 */
export class VideoEventBuilder {
  private readonly frames: readonly FramePayload[];
  private readonly frameCount: number;
  private readonly allowedMissCount: number;

  /**
   * @param frames Recognized frames in frame order.
   * @param frameCount Frames of the video.
   * @param allowedMissCount Sampled frames without the class that may lie inside one event.
   */
  constructor(frames: readonly FramePayload[], frameCount: number, allowedMissCount: number) {
    this.frames = frames.filter((frame) => frame.is_recognized && frame.frame !== null);
    this.frameCount = frameCount;
    this.allowedMissCount = Math.max(0, allowedMissCount);
  }

  build(): VideoEventSummary {
    const samplesByClass = new Map<string, ClassSample[]>();
    const openEvents = new Map<string, OpenEvent>();
    const events: VideoEvent[] = [];
    this.frames.forEach((payload, position) => {
      const frame = payload.frame ?? 0;
      const nextFrame = this.frames[position + 1]?.frame ?? this.frameCount;
      const found = VideoEventBuilder.keptByClass(payload);
      for (const [className, sample] of found) {
        const samples = samplesByClass.get(className) ?? [];
        samples.push({ frame, nextFrame, count: sample.count, confidence: sample.confidence });
        samplesByClass.set(className, samples);
        const open = openEvents.get(className);
        if (open === undefined) {
          openEvents.set(className, { event: VideoEventBuilder.started(className, frame, nextFrame, sample), missedCount: 0 });
          continue;
        }
        VideoEventBuilder.extend(open.event, frame, nextFrame, sample);
        open.missedCount = 0;
      }
      for (const [className, open] of openEvents) {
        if (found.has(className)) continue;
        open.missedCount += 1;
        if (open.missedCount > this.allowedMissCount) {
          events.push(open.event);
          openEvents.delete(className);
        }
      }
    });
    for (const open of openEvents.values()) events.push(open.event);
    events.sort((left, right) => left.startFrame - right.startFrame || left.className.localeCompare(right.className));
    const tracks: ClassTrack[] = [...samplesByClass.entries()].map(([className, samples]) => {
      const classEvents = events.filter((event) => event.className === className);
      return {
        className,
        samples,
        sampleCount: samples.length,
        eventCount: classEvents.length,
        totalFrames: classEvents.reduce((total, event) => total + event.shownEndFrame - event.startFrame, 0),
      };
    });
    tracks.sort((left, right) => right.totalFrames - left.totalFrames || left.className.localeCompare(right.className));
    return { tracks, events, recognizedCount: this.frames.length };
  }

  private static keptByClass(payload: FramePayload): Map<string, { count: number; confidence: number }> {
    const found = new Map<string, { count: number; confidence: number }>();
    for (const finding of payload.findings) {
      if (!finding.is_accepted) continue;
      const entry = found.get(finding.class_name) ?? { count: 0, confidence: 0 };
      entry.count += 1;
      entry.confidence = Math.max(entry.confidence, finding.confidence);
      found.set(finding.class_name, entry);
    }
    return found;
  }

  private static started(
    className: string,
    frame: number,
    nextFrame: number,
    sample: { count: number; confidence: number },
  ): VideoEvent {
    return {
      key: `${className}@${frame}`,
      className,
      startFrame: frame,
      endFrame: frame,
      shownEndFrame: nextFrame,
      peakFrame: frame,
      peakConfidence: sample.confidence,
      maximumCount: sample.count,
      sampleCount: 1,
    };
  }

  private static extend(event: VideoEvent, frame: number, nextFrame: number, sample: { count: number; confidence: number }): void {
    event.endFrame = frame;
    event.shownEndFrame = nextFrame;
    event.sampleCount += 1;
    event.maximumCount = Math.max(event.maximumCount, sample.count);
    if (sample.confidence > event.peakConfidence) {
      event.peakConfidence = sample.confidence;
      event.peakFrame = frame;
    }
  }
}
