import type { MaskOutlineCache, MaskOutlines } from "../lib/maskOutlineCache";
import type { FindingRow } from "../lib/resultTable";
import { useAsyncResource } from "./useAsyncResource";

function resultKeyOf(rows: FindingRow[]): string {
  return rows.map((row) => `${row.finding.index}:${row.finding.confidence}`).join(",");
}

/**
 * Loads the mask outlines of one picture of a gallery once it is wanted, reloading when its findings change.
 */
export function useMaskOutlines(
  cache: MaskOutlineCache,
  rows: FindingRow[],
  isWanted: boolean,
): MaskOutlines | null {
  const first = rows[0];
  const resultKey = resultKeyOf(rows);
  return useAsyncResource(
    !isWanted || first === undefined ? null : JSON.stringify([first.path, first.frame, resultKey]),
    () => cache.outlinesOf(first?.path ?? "", first?.frame ?? null, resultKey),
    { isStaleShown: false },
  );
}
