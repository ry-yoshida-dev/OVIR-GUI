import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TaskValue } from "../api/types";
import {
  type ColumnCondition,
  type ColumnDefinition,
  type ColumnKey,
  columnsOf,
  formatNumber,
  frameText,
  pictureKeyOf,
  type ResultScope,
  runnerUpTextOf,
  type SortOrder,
  type TableFilter,
  type TableRow,
} from "../lib/resultTable";
import { FilterPopup } from "./FilterPopup";
import { useMenu } from "./Menu";
import { ResultsHeading } from "./ResultsHeading";

interface ResultTableProps {
  task: TaskValue;
  scope: ResultScope;
  title: string;
  emptyText: string;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  rows: TableRow[];
  allRows: TableRow[];
  filter: TableFilter;
  onFilterChange: (filter: TableFilter) => void;
  order: SortOrder | null;
  onOrderChange: (order: SortOrder | null) => void;
  currentPictureKey: string | null;
  selectedKey: string | null;
  onSelectRow: (row: TableRow) => void;
  onSetAccepted: (rows: TableRow[], isAccepted: boolean) => void;
  classColors: Record<string, string>;
}

const ROW_HEIGHT = 25;
const OVERSCAN = 12;

export function ResultTable({
  task,
  scope,
  title,
  emptyText,
  isCollapsed,
  onToggleCollapsed,
  rows,
  allRows,
  filter,
  onFilterChange,
  order,
  onOrderChange,
  currentPictureKey,
  selectedKey,
  onSelectRow,
  onSetAccepted,
  classColors,
}: ResultTableProps) {
  const menu = useMenu();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [popup, setPopup] = useState<{ column: ColumnDefinition; x: number; y: number } | null>(null);
  const columns = columnsOf(task, scope);
  const statusLeadCount = columns.findIndex((column) => column.key === "class");

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element === null) return;
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [isCollapsed]);

  useEffect(() => {
    if (selectedKey === null) return;
    const index = rows.findIndex((row) => row.key === selectedKey);
    const element = scroller.current;
    if (index < 0 || element === null) return;
    const top = index * ROW_HEIGHT;
    const headerHeight = 28;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight - headerHeight) {
      element.scrollTop = top + ROW_HEIGHT - element.clientHeight + headerHeight;
    }
  }, [selectedKey, rows]);

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(first, last);
  const filteredCount = Object.keys(filter).filter((key) => columns.some((column) => column.key === key)).length;
  const findingRows = rows.filter((row) => row.kind === "finding");

  const setCondition = (key: ColumnKey, condition: ColumnCondition | undefined) => {
    const next = { ...filter };
    if (condition === undefined) delete next[key];
    else next[key] = condition;
    onFilterChange(next);
  };

  const cycleOrder = (key: ColumnKey) => {
    const isDescendingFirst = key === "confidence" || key === "area";
    if (order === null || order.key !== key) onOrderChange({ key, isDescending: isDescendingFirst });
    else if (order.isDescending === isDescendingFirst) onOrderChange({ key, isDescending: !order.isDescending });
    else onOrderChange(null);
  };

  const openTableMenu = (x: number, y: number) =>
    menu.open(x, y, [
      {
        label: `Keep All Listed (${findingRows.length})`,
        isDisabled: findingRows.length === 0,
        onSelect: () => onSetAccepted(findingRows, true),
      },
      {
        label: `Reject All Listed (${findingRows.length})`,
        isDisabled: findingRows.length === 0,
        onSelect: () => onSetAccepted(findingRows, false),
      },
      { isSeparator: true, label: "" },
      { label: "Clear Filters", isDisabled: filteredCount === 0, onSelect: () => onFilterChange({}) },
    ]);

  const moveSelection = (delta: number) => {
    const index = rows.findIndex((row) => row.key === selectedKey);
    const next = rows[Math.max(0, Math.min(rows.length - 1, (index < 0 ? -1 : index) + delta))];
    if (next !== undefined) onSelectRow(next);
  };

  const renderCell = (row: TableRow, column: ColumnDefinition) => {
    switch (column.key) {
      case "keep":
        return row.kind === "finding" ? (
          <input
            type="checkbox"
            checked={row.finding.is_accepted}
            title="Checked findings are exported; uncheck to reject this one"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onSetAccepted([row], event.target.checked)}
          />
        ) : null;
      case "media":
        return (
          <>
            {row.outdated !== null && <span style={{ color: "var(--warning)", marginRight: 4 }}>⚠</span>}
            {row.mediaName}
          </>
        );
      case "frame":
        return frameText(row.frame, row.seconds);
      case "runner_up":
        return <span className="muted">{runnerUpTextOf(row.scores) ?? ""}</span>;
      default:
        break;
    }
    if (row.kind === "status") return null;
    const finding = row.finding;
    switch (column.key) {
      case "class":
        return (
          <>
            <span
              className="swatch"
              style={{
                background: classColors[finding.class_name] ?? "var(--border-strong)",
                display: "inline-block",
                marginRight: 5,
                verticalAlign: -1,
              }}
            />
            {finding.class_name}
          </>
        );
      case "query":
        return finding.query;
      case "confidence":
        return formatNumber(finding.confidence, "confidence");
      case "area":
        return finding.area === null ? "" : formatNumber(finding.area, "area");
      case "x1":
      case "y1":
      case "x2":
      case "y2": {
        const value = finding.box?.[["x1", "y1", "x2", "y2"].indexOf(column.key)];
        return value === undefined ? "" : formatNumber(value, column.key);
      }
    }
  };

  const isNumeric = (key: ColumnKey) =>
    key === "confidence" || key === "area" || key === "x1" || key === "y1" || key === "x2" || key === "y2";

  return (
    <div className="result-table">
      <ResultsHeading title={title} isCollapsed={isCollapsed} onToggle={onToggleCollapsed}>
        {!isCollapsed && (
          <>
            <button
              className="ghost small"
              onClick={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                menu.openBelow(
                  event.currentTarget,
                  columns.map((column) => ({
                    label: column.label,
                    isChecked: filter[column.key] !== undefined,
                    onSelect: () => setPopup({ column, x: bounds.left, y: bounds.bottom + 4 }),
                  })),
                );
              }}
            >
              Filter{filteredCount > 0 ? ` (${filteredCount})` : ""}
            </button>
            {filteredCount > 0 && (
              <button className="ghost small" onClick={() => onFilterChange({})}>
                Clear Filters
              </button>
            )}
          </>
        )}
        <span className="grow" />
        <span className="muted small">{findingRows.length} listed</span>
      </ResultsHeading>
      {!isCollapsed && (
        <div
          ref={scroller}
          className="table-wrap"
          tabIndex={0}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          onContextMenu={(event) => {
            event.preventDefault();
            openTableMenu(event.clientX, event.clientY);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveSelection(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveSelection(-1);
            } else if (event.key === " ") {
              event.preventDefault();
              const row = rows.find((candidate) => candidate.key === selectedKey);
              if (row?.kind === "finding") onSetAccepted([row], !row.finding.is_accepted);
            }
          }}
        >
          <table className="grid">
            <colgroup>
              {columns.map((column) => (
                <col key={column.key} style={{ width: column.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    title="Click to sort; right-click to filter"
                    onClick={() => cycleOrder(column.key)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setPopup({ column, x: event.clientX, y: event.clientY });
                    }}
                  >
                    {column.label}
                    {order?.key === column.key && (order.isDescending ? " ▾" : " ▴")}
                    {filter[column.key] !== undefined && (
                      <span
                        className="funnel"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPopup({ column, x: event.clientX, y: event.clientY });
                        }}
                      >
                        ⏷
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr className="status">
                  <td colSpan={columns.length}>{allRows.length > 0 ? "Nothing passes the filters." : emptyText}</td>
                </tr>
              )}
              {first > 0 && (
                <tr style={{ height: first * ROW_HEIGHT }}>
                  <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                </tr>
              )}
              {visibleRows.map((row) => {
                const isCurrent = pictureKeyOf(row.path, row.frame) === currentPictureKey;
                const isSelected = row.key === selectedKey;
                const classes = [
                  isSelected ? "selected" : isCurrent ? "current" : "",
                  row.kind === "status" ? "status" : row.finding.is_accepted ? "" : "rejected",
                  row.kind === "finding" && !row.finding.is_passing ? "below-minimum" : "",
                ].join(" ");
                return (
                  <tr key={row.key} className={classes} onClick={() => onSelectRow(row)} style={{ height: ROW_HEIGHT }}>
                    {row.kind === "status" ? (
                      <>
                        {columns.slice(0, statusLeadCount).map((column) => (
                          <td key={column.key} title={column.key === "media" ? row.path : undefined}>
                            {renderCell(row, column)}
                          </td>
                        ))}
                        <td colSpan={columns.length - statusLeadCount}>{row.text}</td>
                      </>
                    ) : (
                      columns.map((column) => (
                        <td
                          key={column.key}
                          className={`${isNumeric(column.key) ? "number" : ""}${column.key === "keep" ? "" : " strike"}`}
                          title={
                            column.key === "media"
                              ? row.outdated === null
                                ? row.path
                                : `${row.path}\nInferred with other classes: ${row.outdated}`
                              : undefined
                          }
                        >
                          {renderCell(row, column)}
                        </td>
                      ))
                    )}
                  </tr>
                );
              })}
              {last < rows.length && (
                <tr style={{ height: (rows.length - last) * ROW_HEIGHT }}>
                  <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {popup !== null && (
        <FilterPopup
          column={popup.column}
          rows={allRows}
          condition={filter[popup.column.key]}
          x={popup.x}
          y={popup.y}
          onApply={(condition) => setCondition(popup.column.key, condition)}
          onClose={() => setPopup(null)}
        />
      )}
      {menu.element}
    </div>
  );
}
