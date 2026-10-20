type Listener = () => void;

/**
 * Frame shown by the video player, shared with panels that follow playback without re-rendering the whole app.
 */
export class PlaybackPosition {
  private frame: number | null = null;
  private readonly listeners = new Set<Listener>();

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly current = (): number | null => this.frame;

  publish(frame: number | null): void {
    if (frame === this.frame) return;
    this.frame = frame;
    for (const listener of this.listeners) listener();
  }
}
