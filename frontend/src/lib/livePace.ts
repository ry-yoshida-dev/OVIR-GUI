interface FrontierSample {
  at: number;
  frontier: number;
}

/**
 * Estimates how fast recognition advances through a video and the playback rate that keeps playback just behind it.
 */
export class LivePace {
  private static readonly WINDOW_MILLISECONDS = 8000;
  private static readonly SAFETY_FACTOR = 0.9;
  private static readonly MINIMUM_RATE = 0.0625;
  private static readonly MAXIMUM_RATE = 1;
  private samples: FrontierSample[] = [];

  record(frontier: number, at: number): void {
    const last = this.samples[this.samples.length - 1];
    if (last !== undefined && frontier <= last.frontier) return;
    this.samples.push({ frontier, at });
    this.samples = this.samples.filter((sample) => at - sample.at <= LivePace.WINDOW_MILLISECONDS);
  }

  reset(): void {
    this.samples = [];
  }

  /**
   * Playback rate matching recognition, or ``null`` until two advances were seen.
   */
  rateFor(framesPerSecond: number): number | null {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (first === undefined || last === undefined || last.at <= first.at || framesPerSecond <= 0) return null;
    const recognizedFramesPerSecond = ((last.frontier - first.frontier) * 1000) / (last.at - first.at);
    const rate = (recognizedFramesPerSecond / framesPerSecond) * LivePace.SAFETY_FACTOR;
    return Math.min(LivePace.MAXIMUM_RATE, Math.max(LivePace.MINIMUM_RATE, rate));
  }
}
