import {
  cellValue,
  type ColumnCondition,
  type ColumnKey,
  type FindingRow,
  filterRows,
  formatNumber,
  spanOf,
  type TableFilter,
  type TableRow,
  valuesOf,
} from "./resultTable";
import { UNIT_RANGE, type ValueRange } from "./scoreHistogram";

export interface ValueShare {
  value: string;
  share: number;
}

export function filterWithout(
  filter: TableFilter,
  key: ColumnKey,
): TableFilter {
  const { [key]: _omitted, ...rest } = filter;
  return rest;
}

/**
 * Findings that pass every condition but the one on the given column, so a column's breakdown shows what its own
 * condition chooses from.
 */
export function facetFindingsOf(
  rows: TableRow[],
  filter: TableFilter,
  key: ColumnKey,
): FindingRow[] {
  return filterRows(rows, filterWithout(filter, key)).filter(
    (row): row is FindingRow => row.kind === "finding",
  );
}

/**
 * Every value the column takes in the rows together with the known values it may take, sorted by name.
 */
export function facetValuesOf(
  rows: TableRow[],
  key: ColumnKey,
  knownValues: readonly string[],
): string[] {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return [...new Set([...valuesOf(rows, key), ...knownValues])].sort(
    collator.compare,
  );
}

/**
 * Each of the values with its share of the findings.
 */
export function valueSharesOf(
  values: string[],
  findings: FindingRow[],
  key: ColumnKey,
): ValueShare[] {
  const counts = new Map<string, number>();
  for (const row of findings) {
    const value = cellValue(row, key);
    if (value === null) continue;
    const text = String(value);
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  const total = Math.max(findings.length, 1);
  return values.map((value) => ({
    value,
    share: (counts.get(value) ?? 0) / total,
  }));
}

export function numbersOf(findings: FindingRow[], key: ColumnKey): number[] {
  const numbers: number[] = [];
  for (const row of findings) {
    const value = cellValue(row, key);
    if (typeof value === "number") numbers.push(value);
  }
  return numbers;
}

export function rangeDomainOf(rows: TableRow[], key: ColumnKey): ValueRange {
  if (key === "confidence") return UNIT_RANGE;
  const span = spanOf(rows, key);
  if (span === null) return UNIT_RANGE;
  const [lower, upper] = span;
  return { lower, upper: upper > lower ? upper : lower + 1 };
}

export function roundedBound(value: number, key: ColumnKey): number {
  switch (key) {
    case "confidence":
      return Math.round(value * 100) / 100;
    case "frame":
      return Math.round(value);
    default:
      return Math.round(value * 10) / 10;
  }
}

export function boundText(value: number, key: ColumnKey): string {
  return key === "confidence" ? value.toFixed(2) : formatNumber(value, key);
}

export function shareInRange(
  numbers: number[],
  lower: number,
  upper: number,
): number {
  if (numbers.length === 0) return 0;
  return (
    numbers.filter((value) => value >= lower && value <= upper).length /
    numbers.length
  );
}

export function percentText(share: number): string {
  if (share > 0 && share < 0.005) return "<1%";
  return `${Math.round(share * 100)}%`;
}

/**
 * Short state of a column's condition: "All", how many values are chosen, or the bounds of its range.
 */
export function conditionText(
  condition: ColumnCondition | undefined,
  valueCount: number,
  key: ColumnKey,
): string {
  if (condition === undefined) return "All";
  if (condition.kind === "values")
    return `${condition.values.length} of ${valueCount}`;
  const { minimum, maximum } = condition;
  if (minimum !== null && maximum !== null)
    return `${boundText(minimum, key)} – ${boundText(maximum, key)}`;
  if (minimum !== null) return `≥ ${boundText(minimum, key)}`;
  if (maximum !== null) return `≤ ${boundText(maximum, key)}`;
  return "All";
}
