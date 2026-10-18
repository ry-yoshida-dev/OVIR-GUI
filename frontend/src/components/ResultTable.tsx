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
  type SortOrder,
  type TableFilter,
  type TableRow,
} from "../lib/resultTable";
import { useDialogs } from "./DialogHost";
import { FilterPopup } from "./FilterPopup";
import { useMenu } from "./Menu";

interface ResultTableProps {
  task: TaskValue;
  rows: TableRow[];
  allRows: TableRow[];
  filter: TableFilter;
  onFilterChange: (filter: TableFilter) => void;
  order: SortOrder | null;
  onOrderChange: (order: SortOrder | null) => void;
  currentPictureKey: string | null;
  selectedKey: string | null;
  isShownMediaOnly: boolean;
  onShownMediaOnlyChange: (isShownMediaOnly: boolean) => void;
  onSelectRow: (row: TableRow) => void;
  onSetAccepted: (rows: TableRow[], isAccepted: boolean) => void;
  onSaveCsv: () => void;
  onUpdateOutdated: () => void;
  onClearResults: () => void;
  outdatedCount: number;
  hasResults: boolean;
  classColors: Record<string, string>;
}

const ROW_HEIGHT = 25;
const OVERSCAN = 12;

function titleOf(task: TaskValue): string {
  switch (task) {
    case "classification":
      return "Predictions";
    case "detection":
      return "Detections";
    case "segmentation":
      return "Instances";
  }
}

export function ResultTable({
  task,
  rows,
  allRows,
  filter,
  onFilterChange,
  order,
  onOrderChange,
  currentPictureKey,
  selectedKey,
  isShownMediaOnly,
  onShownMediaOnlyChange,
  onSelectRow,
  onSetAccepted,
  onSaveCsv,
  onUpdateOutdated,
  onClearResults,
  outdatedCount,
  hasResults,
  classColors,
}: ResultTableProps) {
  const dialogs = useDialogs();
  const menu = useMenu();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [popup, setPopup] = useState<{ column: ColumnDefinition; x: number; y: number } | null>(null);
  const columns = columnsOf(task);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element === null) return;
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
      { label: "Save Listed as CSV…", isDisabled: findingRows.length === 0, onSelect: onSaveCsv },
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
        return <span className="muted">{row.runnerUp ?? ""}</span>;
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div className="panel-title">
        <span className="grow">{titleOf(task)}</span>
        <label className="small" title="List only the findings of the shown image or video">
          <input
            type="checkbox"
            checked={isShownMediaOnly}
            onChange={(event) => onShownMediaOnlyChange(event.target.checked)}
          />
          Shown file only
        </label>
        <span className="muted small">
          {findingRows.length} listed{filteredCount > 0 ? ` · ${filteredCount} filters` : ""}
        </span>
      </div>
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
                <td colSpan={columns.length}>
                  {allRows.length === 0
                    ? "Open images or videos; their results are listed here as they are recognized."
                    : "Nothing passes the filters."}
                </td>
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
              ].join(" ");
              return (
                <tr key={row.key} className={classes} onClick={() => onSelectRow(row)} style={{ height: ROW_HEIGHT }}>
                  {row.kind === "status" ? (
                    <>
                      {columns.slice(0, 3).map((column) => (
                        <td key={column.key} title={column.key === "media" ? row.path : undefined}>
                          {renderCell(row, column)}
                        </td>
                      ))}
                      <td colSpan={columns.length - 3}>{row.text}</td>
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
                              : `${row.path}\nRecognized with other classes: ${row.outdated}`
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
      <div className="panel-footer">
        <button
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            menu.openBelow(
              event.currentTarget,
              columns.map((column) => ({
                label: column.label,
                isChecked: filter[column.key] !== undefined,
                onSelect: () => setPopup({ column, x: bounds.left, y: bounds.top - 320 }),
              })),
            );
          }}
        >
          Filter{filteredCount > 0 ? ` (${filteredCount})` : ""}
        </button>
        <button onClick={() => onFilterChange({})} disabled={filteredCount === 0}>
          Clear Filters
        </button>
        <button
          onClick={onUpdateOutdated}
          disabled={outdatedCount === 0}
          title="Recognize again the pictures recognized with other classes"
        >
          Update Outdated{outdatedCount > 0 ? ` (${outdatedCount})` : ""}
        </button>
        <span className="grow" />
        <button onClick={onSaveCsv} disabled={findingRows.length === 0}>
          Save CSV…
        </button>
        <button
          className="danger"
          disabled={!hasResults}
          onClick={async () => {
            const isConfirmed = await dialogs.confirm({
              title: "Clear Results",
              message: "Forget the stored results of every model of this task?",
              confirmLabel: "Clear",
              isDanger: true,
            });
            if (isConfirmed) onClearResults();
          }}
        >
          Clear Results
        </button>
      </div>
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
