import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDismiss } from "../hooks/useDismiss";
import {
  conditionText,
  facetFindingsOf,
  facetValuesOf,
  numbersOf,
  rangeDomainOf,
  valueSharesOf,
} from "../lib/columnFacets";
import { type ClassColors, classColorOf, SWATCH_FALLBACK_COLOR } from "../lib/frameView";
import { clamp } from "../lib/numbers";
import {
  type ColumnCondition,
  type ColumnDefinition,
  type ColumnKey,
  type TableFilter,
  type TableRow,
} from "../lib/resultTable";
import { UNIT_RANGE } from "../lib/scoreHistogram";
import type { ViewportPosition } from "../lib/viewportPlacement";
import { RangeFacet } from "./RangeFacet";
import { ValueFacet } from "./ValueFacet";

interface FilterPanelProps {
  columns: ColumnDefinition[];
  rows: TableRow[];
  filter: TableFilter;
  initialKey: ColumnKey;
  anchor: RefObject<HTMLElement | null>;
  listedCount: number;
  totalCount: number;
  classColors: ClassColors;
  onConditionChange: (key: ColumnKey, condition: ColumnCondition | undefined) => void;
  onClear: () => void;
  onClose: () => void;
}

const PANE_GAP = 12;
const WINDOW_MARGIN = 8;

/**
 * Places the panel beside the pane holding the anchor, centred on the anchor and kept inside the window.
 */
function placeBeside(anchor: HTMLElement, panel: HTMLElement): ViewportPosition {
  const anchorBounds = anchor.getBoundingClientRect();
  const paneLeft = anchor.closest(".pane")?.getBoundingClientRect().left ?? anchorBounds.left;
  const { width, height } = panel.getBoundingClientRect();
  return {
    left: Math.max(WINDOW_MARGIN, paneLeft - PANE_GAP - width),
    top: clamp(
      anchorBounds.top + anchorBounds.height / 2 - height / 2,
      WINDOW_MARGIN,
      Math.max(WINDOW_MARGIN, window.innerHeight - height - WINDOW_MARGIN),
    ),
  };
}

/**
 * Floating panel listing every filterable column with its current condition beside the breakdown of the chosen one;
 * every change applies to the table at once.
 */
export function FilterPanel({
  columns,
  rows,
  filter,
  initialKey,
  anchor,
  listedCount,
  totalCount,
  classColors,
  onConditionChange,
  onClear,
  onClose,
}: FilterPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const classNames = useMemo(() => Object.keys(classColors), [classColors]);
  const knownValuesOf = (key: ColumnKey): string[] => (key === "class" ? classNames : []);
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [position, setPosition] = useState<ViewportPosition | null>(null);
  useDismiss([panel, anchor], onClose);

  useLayoutEffect(() => {
    if (panel.current === null || anchor.current === null) return;
    setPosition(placeBeside(anchor.current, panel.current));
  }, [anchor]);

  const column = columns.find((candidate) => candidate.key === selectedKey) ?? columns[0];
  const findings = useMemo(
    () => (column === undefined ? [] : facetFindingsOf(rows, filter, column.key)),
    [rows, filter, column],
  );
  const shares = useMemo(
    () => (column?.kind === "values"
        ? valueSharesOf(facetValuesOf(rows, column.key, column.key === "class" ? classNames : []), findings, column.key)
        : []),
    [rows, findings, column, classNames],
  );
  const numbers = useMemo(
    () => (column?.kind === "range" ? numbersOf(findings, column.key) : []),
    [findings, column],
  );
  const domain = useMemo(
    () => (column?.kind === "range" ? rangeDomainOf(rows, column.key) : UNIT_RANGE),
    [rows, column],
  );
  if (column === undefined) return null;
  const condition = filter[column.key];

  return (
    <div
      ref={panel}
      className="filter-panel"
      style={position === null ? { visibility: "hidden", left: 0, top: 0 } : position}
    >
      <div className="filter-panel-rail">
        <div className="filter-panel-tally">
          <b>{listedCount}</b> of {totalCount} listed
        </div>
        {columns.map((candidate) => {
          const candidateCondition = filter[candidate.key];
          return (
            <button
              key={candidate.key}
              className={`filter-panel-item${candidate.key === column.key ? " selected" : ""}${candidateCondition === undefined ? "" : " filtered"}`}
              onClick={() => setSelectedKey(candidate.key)}
            >
              <span className="filter-panel-item-label">{candidate.label}</span>
              <span className="filter-panel-item-state">
                {conditionText(
                  candidateCondition,
                  facetValuesOf(rows, candidate.key, knownValuesOf(candidate.key)).length,
                  candidate.key,
                )}
              </span>
            </button>
          );
        })}
        <span className="grow" />
        <button className="ghost small filter-panel-clear" disabled={Object.keys(filter).length === 0} onClick={onClear}>
          Clear all
        </button>
      </div>
      <div className="filter-panel-detail">
        {column.kind === "values" ? (
          <ValueFacet
            key={column.key}
            column={column}
            shares={shares}
            condition={condition}
            colorOf={
              column.key === "class"
                ? (className) => classColorOf(classColors, className, SWATCH_FALLBACK_COLOR)
                : null
            }
            onChange={(next) => onConditionChange(column.key, next)}
          />
        ) : (
          <RangeFacet
            key={column.key}
            column={column}
            numbers={numbers}
            domain={domain}
            condition={condition}
            onChange={(next) => onConditionChange(column.key, next)}
          />
        )}
      </div>
    </div>
  );
}
