import type { FramePayload } from "../api/types";

export interface ClassTrack {
  className: string;
  counts: number[];
  peakCount: number;
  keptSampleCount: number;
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
  sampleFrames: number[];
  recognizedCount: number;
}

interface OpenEvent {
  event: VideoEvent;
  missedCount: number;
}

/**
 * Turns the per-frame findings of a video into one count track per class and the spans where each class keeps being found.
 *
 * Only findings that are accepted and above the class minimum are counted.
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
  constructor(
    frames: readonly FramePayload[],
    frameCount: number,
    allowedMissCount: number,
  ) {
    this.frames = frames.filter(
      (frame) => frame.is_recognized && frame.frame !== null,
    );
    this.frameCount = frameCount;
    this.allowedMissCount = Math.max(0, allowedMissCount);
  }

  build(): VideoEventSummary {
    const sampleFrames = this.frames.map((payload) => payload.frame ?? 0);
    const countsByClass = new Map<string, number[]>();
    const openEvents = new Map<string, OpenEvent>();
    const events: VideoEvent[] = [];
    this.frames.forEach((payload, position) => {
      const frame = sampleFrames[position] ?? 0;
      const nextFrame = sampleFrames[position + 1] ?? this.frameCount;
      const found = VideoEventBuilder.keptByClass(payload);
      for (const [className, sample] of found) {
        const counts =
          countsByClass.get(className) ??
          new Array<number>(sampleFrames.length).fill(0);
        counts[position] = sample.count;
        countsByClass.set(className, counts);
        const open = openEvents.get(className);
        if (open === undefined) {
          openEvents.set(className, {
            event: VideoEventBuilder.started(
              className,
              frame,
              nextFrame,
              sample,
            ),
            missedCount: 0,
          });
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
    events.sort(
      (left, right) =>
        left.startFrame - right.startFrame ||
        left.className.localeCompare(right.className),
    );
    const tracks: ClassTrack[] = [...countsByClass.entries()].map(
      ([className, counts]) => {
        const classEvents = events.filter(
          (event) => event.className === className,
        );
        return {
          className,
          counts,
          peakCount: Math.max(...counts),
          keptSampleCount: counts.filter((count) => count > 0).length,
          eventCount: classEvents.length,
          totalFrames: classEvents.reduce(
            (total, event) => total + event.shownEndFrame - event.startFrame,
            0,
          ),
        };
      },
    );
    tracks.sort(
      (left, right) =>
        right.totalFrames - left.totalFrames ||
        right.peakCount - left.peakCount ||
        left.className.localeCompare(right.className),
    );
    return {
      tracks,
      events,
      sampleFrames,
      recognizedCount: this.frames.length,
    };
  }

  private static keptByClass(
    payload: FramePayload,
  ): Map<string, { count: number; confidence: number }> {
    const found = new Map<string, { count: number; confidence: number }>();
    for (const finding of payload.findings) {
      if (!finding.is_accepted || !finding.is_passing) continue;
      const entry = found.get(finding.class_name) ?? {
        count: 0,
        confidence: 0,
      };
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

  private static extend(
    event: VideoEvent,
    frame: number,
    nextFrame: number,
    sample: { count: number; confidence: number },
  ): void {
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
