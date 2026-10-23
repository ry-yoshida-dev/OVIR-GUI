const TICK_TARGET_COUNT = 6;
const NICE_SECONDS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

/**
 * Formats a position in a video as minutes and seconds with the given number of fraction digits.
 */
export function formatSeconds(seconds: number, fractionDigits = 1): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(fractionDigits).padStart(fractionDigits + 3, "0")}`;
}

/**
 * Picks evenly spaced ruler ticks on round seconds for a video of the given length.
 */
export function tickSecondsOf(durationSeconds: number): number[] {
  const rough = durationSeconds / TICK_TARGET_COUNT;
  const step =
    NICE_SECONDS.find((candidate) => candidate >= rough) ??
    Math.ceil(rough / 3600) * 3600;
  const ticks: number[] = [];
  for (let seconds = 0; seconds <= durationSeconds; seconds += step)
    ticks.push(seconds);
  return ticks;
}
