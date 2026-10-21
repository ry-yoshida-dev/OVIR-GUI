import type { FramePayload, VideoFramesPayload } from "../api/types";
import { FindingInterpolator } from "./findingInterpolator";

export class FrameResultIndex {
  private readonly frames: FramePayload[];
  private readonly frameIndices: number[];
  private readonly samplingGap: number;

  constructor(payload: VideoFramesPayload) {
    this.frames = payload.frames.filter((frame) => frame.frame !== null);
    this.frameIndices = this.frames.map((frame) => frame.frame ?? 0);
    this.samplingGap = FrameResultIndex.commonGapOf(this.frameIndices);
  }

  get isEmpty(): boolean {
    return this.frames.length === 0;
  }

  get recognizedFrames(): readonly FramePayload[] {
    return this.frames;
  }

  get lastFrame(): number | null {
    return this.frameIndices[this.frameIndices.length - 1] ?? null;
  }

  merged(payload: VideoFramesPayload): FrameResultIndex {
    const byFrame = new Map<number, FramePayload>(
      this.frames.map((frame) => [frame.frame ?? 0, frame]),
    );
    for (const frame of payload.frames) {
      if (frame.frame !== null) byFrame.set(frame.frame, frame);
    }
    const frames = [...byFrame.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, frame]) => frame);
    return new FrameResultIndex({ path: payload.path, frames });
  }

  mapped(transform: (frame: FramePayload) => FramePayload): FrameResultIndex {
    return new FrameResultIndex({
      path: this.frames[0]?.path ?? "",
      frames: this.frames.map(transform),
    });
  }

  coveredUntil(frame: number, frameStep: number): number | null {
    let position = this.positionAt(frame - frameStep) + 1;
    const first = this.frameIndices[position];
    if (first === undefined || first - frame >= frameStep) return null;
    while (position + 1 < this.frameIndices.length) {
      const gap =
        (this.frameIndices[position + 1] ?? 0) -
        (this.frameIndices[position] ?? 0);
      if (gap > frameStep) break;
      position += 1;
    }
    return this.frameIndices[position] ?? null;
  }

  resultAt(frame: number): FramePayload | null {
    const position = this.positionAt(frame);
    const candidate = position < 0 ? undefined : this.frames[position];
    return candidate !== undefined && candidate.frame === frame ? candidate : null;
  }

  interpolatedAt(frame: number): FramePayload | null {
    const position = this.positionAt(frame);
    const before = this.frames[position];
    if (before === undefined) return null;
    if (before.frame === frame) return before;
    const after = this.frames[position + 1];
    const beforeFrame = before.frame ?? frame;
    const afterFrame = after?.frame ?? null;
    if (
      after === undefined ||
      afterFrame === null ||
      afterFrame - beforeFrame > this.samplingGap
    )
      return null;
    if (!before.is_recognized || !after.is_recognized) return null;
    return FindingInterpolator.between(before, after, frame);
  }

  private positionAt(frame: number): number {
    let low = 0;
    let high = this.frameIndices.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((this.frameIndices[middle] ?? 0) <= frame) low = middle + 1;
      else high = middle;
    }
    return low - 1;
  }

  private static commonGapOf(frameIndices: number[]): number {
    const counts = new Map<number, number>();
    for (let position = 1; position < frameIndices.length; position += 1) {
      const gap =
        (frameIndices[position] ?? 0) - (frameIndices[position - 1] ?? 0);
      counts.set(gap, (counts.get(gap) ?? 0) + 1);
    }
    let commonGap = 0;
    let commonCount = 0;
    for (const [gap, count] of counts) {
      if (count > commonCount || (count === commonCount && gap > commonGap)) {
        commonGap = gap;
        commonCount = count;
      }
    }
    return commonGap;
  }
}
