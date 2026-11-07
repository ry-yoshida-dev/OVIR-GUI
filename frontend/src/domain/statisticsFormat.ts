const COMPACT_LIMIT = 10_000;

/**
 * Writes a count with thousands separators, compacted from ten thousand up (12.9K, 4.2M).
 */
export function formatCount(count: number): string {
  if (Math.abs(count) < COMPACT_LIMIT) return count.toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
}

/**
 * Writes a share in [0, 1] as a percentage, with one decimal below 10 % so small shares stay distinct.
 */
export function formatShare(share: number | null): string {
  if (share === null || Number.isNaN(share)) return "–";
  const percent = share * 100;
  if (percent === 0) return "0%";
  if (percent < 0.1) return "<0.1%";
  return `${percent < 10 ? percent.toFixed(1) : Math.round(percent).toString()}%`;
}

/**
 * Writes a confidence or score with two decimals.
 */
export function formatScore(value: number | null): string {
  return value === null ? "–" : value.toFixed(2);
}

/**
 * Share of a part in a whole, null when the whole is empty.
 */
export function shareOf(part: number, whole: number): number | null {
  return whole <= 0 ? null : part / whole;
}

/**
 * Writes a count with its noun, singular for one.
 */
export function countedNoun(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
