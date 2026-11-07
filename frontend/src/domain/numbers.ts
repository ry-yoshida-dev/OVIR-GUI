/**
 * Limits a value to the closed range from the minimum to the maximum; the maximum wins when the range is empty.
 */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

/**
 * Disk size in decimal units, e.g. 1.5 GB or 662 MB, with one decimal below ten.
 */
export function formattedByteSize(bytes: number): string {
  const exponent = clamp(Math.floor(Math.log10(Math.max(bytes, 1)) / 3), 0, BYTE_UNITS.length - 1);
  const value = bytes / 1000 ** exponent;
  return `${value < 10 && exponent > 0 ? value.toFixed(1) : value.toFixed(0)} ${BYTE_UNITS[exponent]}`;
}
