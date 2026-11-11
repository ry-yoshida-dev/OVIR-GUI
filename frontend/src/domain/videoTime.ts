const TICK_TARGET_COUNT = 6;
const NICE_SECONDS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

/**
 * Formats a position in a video as minutes and seconds with the given number of fraction digits.
 */
export function formatSeconds(seconds: number, fractionDigits = 1): string {
  // Round before splitting, so 59.96 s reads 1:00.0 rather than 0:60.0.
  const scale = 10 ** fractionDigits;
  const rounded = Math.round(seconds * scale) / scale;
  const minutes = Math.floor(rounded / 60);
  const rest = Math.max(0, rounded - minutes * 60);
  const width = fractionDigits > 0 ? fractionDigits + 3 : 2;
  return `${minutes}:${rest.toFixed(fractionDigits).padStart(width, "0")}`;
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
