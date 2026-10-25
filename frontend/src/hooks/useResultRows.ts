import { useCallback, useMemo, useState } from "react";
import type { ResultsPayload, TaskValue } from "../api/types";
import type { BelowMinimumStyle } from "../lib/displayOptions";
import {
  buildRows,
  filterOfScope,
  filterRows,
  isExportedRow,
  isRowInScope,
  listedIndices,
  type ResultScope,
  type SortOrder,
  sortRows,
  type TableFilter,
  type TableRow,
} from "../lib/resultTable";

interface ResultRowsOptions {
  results: ResultsPayload | null;
  belowMinimum: BelowMinimumStyle;
  task: TaskValue;
}

export interface ScopedRows {
  inScope: TableRow[];
  listed: TableRow[];
}

export interface ResultRows {
  allRows: TableRow[];
  filteredRows: TableRow[];
  rows: TableRow[];
  images: ScopedRows;
  videos: ScopedRows;
  imageExportRows: TableRow[];
  videoExportRows: TableRow[];
  listed: Map<string, Set<number>>;
  isFiltered: boolean;
  filter: TableFilter;
  setFilter: (filter: TableFilter) => void;
  order: SortOrder | null;
  setOrder: (order: SortOrder | null) => void;
  selectedRowKey: string | null;
  selectedRow: TableRow | null;
  setSelectedRowKey: (key: string | null) => void;
}

function useScopedRows(
  allRows: TableRow[],
  scope: ResultScope,
  filter: TableFilter,
  order: SortOrder | null,
): ScopedRows {
  const inScope = useMemo(
    () => allRows.filter((row) => isRowInScope(row, scope)),
    [allRows, scope],
  );
  const listed = useMemo(
    () => sortRows(filterRows(inScope, filterOfScope(filter, scope)), order),
    [inScope, filter, scope, order],
  );
  return { inScope, listed };
}

const NO_FILTER: TableFilter = {};

/**
 * Builds the rows of the result tables with their filters, order and selection; every task keeps its own filters and
 * order while the app is open.
 */
export function useResultRows({
  results,
  belowMinimum,
  task,
}: ResultRowsOptions): ResultRows {
  const [filters, setFilters] = useState<Partial<Record<TaskValue, TableFilter>>>({});
  const [orders, setOrders] = useState<Partial<Record<TaskValue, SortOrder>>>({});
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const filter = filters[task] ?? NO_FILTER;
  const order = orders[task] ?? null;
  const setFilter = useCallback(
    (next: TableFilter) => setFilters((current) => ({ ...current, [task]: next })),
    [task],
  );
  const setOrder = useCallback(
    (next: SortOrder | null) =>
      setOrders((current) => {
        const { [task]: _left, ...others } = current;
        return next === null ? others : { ...others, [task]: next };
      }),
    [task],
  );

  const allRows = useMemo(
    () => buildRows(results, belowMinimum),
    [results, belowMinimum],
  );
  const filteredRows = useMemo(
    () => filterRows(allRows, filter),
    [allRows, filter],
  );
  const rows = useMemo(
    () => sortRows(filteredRows, order),
    [filteredRows, order],
  );
  const images = useScopedRows(allRows, "images", filter, order);
  const videos = useScopedRows(allRows, "videos", filter, order);
  const imageExportRows = useMemo(
    () => images.listed.filter(isExportedRow),
    [images.listed],
  );
  const videoExportRows = useMemo(
    () => videos.inScope.filter(isExportedRow),
    [videos.inScope],
  );
  const listed = useMemo(() => listedIndices(filteredRows), [filteredRows]);
  const rowsByKey = useMemo(
    () =>
      new Map(
        [...rows, ...videos.listed, ...images.listed].map(
          (row) => [row.key, row] as const,
        ),
      ),
    [rows, videos.listed, images.listed],
  );
  const allRowKeys = useMemo(
    () => new Set(allRows.map((row) => row.key)),
    [allRows],
  );

  if (selectedRowKey !== null && !allRowKeys.has(selectedRowKey))
    setSelectedRowKey(null);

  return {
    allRows,
    filteredRows,
    rows,
    images,
    videos,
    imageExportRows,
    videoExportRows,
    listed,
    isFiltered: Object.keys(filter).length > 0,
    filter,
    setFilter,
    order,
    setOrder,
    selectedRowKey,
    selectedRow:
      selectedRowKey === null ? null : (rowsByKey.get(selectedRowKey) ?? null),
    setSelectedRowKey,
  };
}
