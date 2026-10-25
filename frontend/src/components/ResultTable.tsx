import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TaskValue } from "../api/types";
import { type ClassColors, classColorOf, SWATCH_FALLBACK_COLOR } from "../lib/frameView";
import { type ColumnFonts, fittedColumnWidthsOf } from "../lib/columnWidths";
import { clamp } from "../lib/numbers";
import {
  type ColumnCondition,
  type ColumnDefinition,
  filterOfScope,
  type ColumnKey,
  columnsOf,
  formatNumber,
  frameText,
  pictureKeyOf,
  type ResultScope,
  type SortOrder,
  type TableFilter,
  type TableRow,
} from "../lib/resultTable";
import { PLAIN_TEMPLATE } from "../lib/textTemplate";
import { FilterPanel } from "./FilterPanel";
import { ExportGlyph, FilterGlyph } from "./Glyphs";
import { MediaKindGlyph } from "./MediaKindGlyph";
import { MixedCheckbox } from "./MixedCheckbox";
import { ResultsHeading } from "./ResultsHeading";
import { ScoreBars } from "./ScoreBars";
import { TemplateText } from "./TemplateText";

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
  classColors: ClassColors;
  exportCount: number;
  isExportDisabled: boolean;
  onExport: () => void;
}

const ROW_HEIGHT = 25;
const OVERSCAN = 12;
const HEADER_HEIGHT = 28;

function SpacerRow({ rowCount, columnCount }: { rowCount: number; columnCount: number }) {
  return (
    <tr style={{ height: rowCount * ROW_HEIGHT }}>
      <td colSpan={columnCount} className="spacer-cell" />
    </tr>
  );
}

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
  exportCount,
  isExportDisabled,
  onExport,
}: ResultTableProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [panelKey, setPanelKey] = useState<ColumnKey | null>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const headerRow = useRef<HTMLTableRowElement>(null);
  const [fonts, setFonts] = useState<ColumnFonts | null>(null);
  const [paddings, setPaddings] = useState<number[]>([]);
  const columns = useMemo(() => columnsOf(task, scope), [task, scope]);
  const filterableColumns = useMemo(() => columns.filter((column) => column.isFilterable), [columns]);
  const scopedFilter = useMemo(() => filterOfScope(filter, scope), [filter, scope]);
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
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight - HEADER_HEIGHT) {
      element.scrollTop = top + ROW_HEIGHT - element.clientHeight + HEADER_HEIGHT;
    }
  }, [selectedKey, rows]);

  useLayoutEffect(() => {
    const row = headerRow.current;
    if (row === null) return;
    const headers = [...row.cells].slice(0, columns.length);
    const firstHeader = headers[0];
    const table = row.closest("table");
    if (firstHeader === undefined || table === null) return;
    setFonts({ cell: getComputedStyle(table).font, header: getComputedStyle(firstHeader).font });
    setPaddings(
      headers.map((header) => {
        const style = getComputedStyle(header);
        return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      }),
    );
  }, [isCollapsed, columns]);

  const widths = useMemo(
    () =>
      fonts === null
        ? columns.map((column) => column.maxWidth)
        : fittedColumnWidthsOf(columns, allRows, fonts, paddings, {
            sortedKey: order?.key ?? null,
            filteredKeys: new Set(columns.map((column) => column.key).filter((key) => filter[key] !== undefined)),
          }),
    [columns, allRows, fonts, paddings, order, filter],
  );

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(first, last);
  const filteredCount = Object.keys(scopedFilter).length;
  const findingRows = useMemo(() => rows.filter((row) => row.kind === "finding"), [rows]);
  const keptCount = findingRows.filter((row) => row.finding.is_accepted).length;
  const totalFindingCount = useMemo(() => allRows.filter((row) => row.kind === "finding").length, [allRows]);
  const firstPanelKey =
    filterableColumns.find((column) => scopedFilter[column.key] !== undefined)?.key ??
    filterableColumns.find((column) => column.key === "class")?.key ??
    filterableColumns[0]?.key ??
    null;

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

  const moveSelection = (delta: number) => {
    const index = rows.findIndex((row) => row.key === selectedKey);
    const next = rows[clamp(index + delta, 0, rows.length - 1)];
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
            {row.outdated !== null && <span className="outdated-mark">⚠</span>}
            {row.mediaName}
          </>
        );
      case "frame":
        return frameText(row.frame, row.seconds);
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
              className="swatch inline-swatch"
              style={{ background: classColorOf(classColors, finding.class_name, SWATCH_FALLBACK_COLOR) }}
            />
            {finding.class_name}
          </>
        );
      case "prompt":
        return finding.matched_prompt;
      case "template":
        if (finding.matched_template === null) return null;
        return finding.matched_template === PLAIN_TEMPLATE ? (
          <span className="muted">None</span>
        ) : (
          <TemplateText template={finding.matched_template} />
        );
      case "confidence":
        return (
          <>
            {formatNumber(finding.confidence, "confidence")}
            {row.scores.length > 0 && (
              <ScoreBars
                scores={row.scores}
                colorOf={(className) => classColorOf(classColors, className, SWATCH_FALLBACK_COLOR)}
              />
            )}
          </>
        );
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

  return (
    <div className="result-table">
      <ResultsHeading
        title={title}
        icon={<MediaKindGlyph kind={scope === "images" ? "image" : "video"} />}
        isCollapsed={isCollapsed}
        onToggle={onToggleCollapsed}
      >
        {!isCollapsed && (
          <button
            ref={filterButton}
            className={`small filter-button${filteredCount > 0 ? " active" : ""}${panelKey === null ? "" : " open"}`}
            title="Filter the listed findings"
            onClick={() => setPanelKey(panelKey === null ? firstPanelKey : null)}
          >
            <FilterGlyph />
            Filter{filteredCount > 0 && ` · ${filteredCount}`}
          </button>
        )}
        <span className="muted small">
          {filteredCount > 0 ? `${findingRows.length} of ${totalFindingCount}` : findingRows.length} listed
        </span>
        <span className="grow" />
        <button
          className="small export-button"
          disabled={isExportDisabled}
          onClick={onExport}
          title="Export the listed pictures with their kept findings (Ctrl+E)"
        >
          <ExportGlyph />
          Export {exportCount}
        </button>
      </ResultsHeading>
      {!isCollapsed && (
        <div
          ref={scroller}
          className="table-wrap"
          tabIndex={0}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
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
              {columns.map((column, index) => (
                <col key={column.key} style={{ width: widths[index] }} />
              ))}
              <col />
            </colgroup>
            <thead>
              <tr ref={headerRow}>
                {columns.map((column) => (
                  <th key={column.key} title="Click to sort" onClick={() => cycleOrder(column.key)}>
                    {column.key === "keep" ? (
                      <MixedCheckbox
                        checkedCount={keptCount}
                        totalCount={findingRows.length}
                        title="Keep every listed finding; uncheck to reject them all"
                        onChange={(isChecked) => onSetAccepted(findingRows, isChecked)}
                      />
                    ) : (
                      column.label
                    )}
                    {order?.key === column.key && (order.isDescending ? " ▾" : " ▴")}
                    {filter[column.key] !== undefined && (
                      <span
                        className="funnel"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPanelKey(column.key);
                        }}
                      >
                        <FilterGlyph />
                      </span>
                    )}
                  </th>
                ))}
                <th className="filler" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr className="status">
                  <td colSpan={columns.length + 1}>{allRows.length > 0 ? "Nothing passes the filters." : emptyText}</td>
                </tr>
              )}
              {first > 0 && <SpacerRow rowCount={first} columnCount={columns.length + 1} />}
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
                        <td colSpan={columns.length - statusLeadCount + 1}>{row.text}</td>
                      </>
                    ) : (
                      <>
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={`${column.isNumeric ? "number" : ""}${column.key === "keep" ? "" : " strike"}`}
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
                        ))}
                        <td className="filler" />
                      </>
                    )}
                  </tr>
                );
              })}
              {last < rows.length && <SpacerRow rowCount={rows.length - last} columnCount={columns.length + 1} />}
            </tbody>
          </table>
        </div>
      )}
      {panelKey !== null && !isCollapsed && (
        <FilterPanel
          columns={filterableColumns}
          rows={allRows}
          filter={scopedFilter}
          initialKey={panelKey}
          anchor={filterButton}
          listedCount={findingRows.length}
          totalCount={totalFindingCount}
          classColors={classColors}
          onConditionChange={setCondition}
          onClear={() => onFilterChange({})}
          onClose={() => setPanelKey(null)}
        />
      )}
    </div>
  );
}
