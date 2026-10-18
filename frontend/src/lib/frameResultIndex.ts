import type { FramePayload, VideoFramesPayload } from "../api/types";

export class FrameResultIndex {
  private readonly frames: FramePayload[];
  private readonly frameIndices: number[];

  constructor(payload: VideoFramesPayload) {
    this.frames = payload.frames.filter((frame) => frame.frame !== null);
    this.frameIndices = this.frames.map((frame) => frame.frame ?? 0);
  }

  get isEmpty(): boolean {
    return this.frames.length === 0;
  }

  resultAt(frame: number): FramePayload | null {
    let low = 0;
    let high = this.frameIndices.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((this.frameIndices[middle] ?? 0) <= frame) low = middle + 1;
      else high = middle;
    }
    return low === 0 ? null : (this.frames[low - 1] ?? null);
  }
}
