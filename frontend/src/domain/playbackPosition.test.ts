import { describe, expect, it, vi } from "vitest";
import { PlaybackPosition } from "@/domain/playbackPosition";

describe("PlaybackPosition", () => {
  it("starts without a frame", () => {
    expect(new PlaybackPosition().current()).toBeNull();
  });

  it("stores the published frame and notifies every listener", () => {
    const position = new PlaybackPosition();
    const first = vi.fn();
    const second = vi.fn();
    position.subscribe(first);
    position.subscribe(second);
    position.publish(12);
    expect(position.current()).toBe(12);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not notify when the same frame is published again", () => {
    const position = new PlaybackPosition();
    const listener = vi.fn();
    position.subscribe(listener);
    position.publish(3);
    position.publish(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies when the frame is cleared", () => {
    const position = new PlaybackPosition();
    position.publish(3);
    const listener = vi.fn();
    position.subscribe(listener);
    position.publish(null);
    expect(position.current()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify while still without a frame", () => {
    const position = new PlaybackPosition();
    const listener = vi.fn();
    position.subscribe(listener);
    position.publish(null);
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying a listener after it unsubscribes", () => {
    const position = new PlaybackPosition();
    const listener = vi.fn();
    const unsubscribe = position.subscribe(listener);
    unsubscribe();
    position.publish(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
