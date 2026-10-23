/**
 * Limits a value to the closed range from the minimum to the maximum; the maximum wins when the range is empty.
 */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
