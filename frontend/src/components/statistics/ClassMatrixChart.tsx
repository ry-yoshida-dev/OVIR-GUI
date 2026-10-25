import type { CSSProperties } from "react";
import type { ClassMatrixPayload } from "../../api/types";
import { type ClassColors, classColorOf, SWATCH_FALLBACK_COLOR } from "../../lib/frameView";
import { formatCount } from "../../lib/statisticsFormat";

export type MatrixDiagonal = "hidden" | "neutral" | "agreement";

interface ClassMatrixChartProps {
  matrix: ClassMatrixPayload;
  classColors: ClassColors;
  diagonal: MatrixDiagonal;
  isLowerTriangle: boolean;
  rowTitle?: string;
  columnTitle?: string;
  cellTitleOf: (rowName: string, columnName: string, count: number) => string;
}

const INK_SWITCH_SHARE = 0.55;
const MINIMUM_FILL_SHARE = 0.08;

function shownIndices(matrix: ClassMatrixPayload): number[] {
  return matrix.class_names
    .map((_, index) => index)
    .filter(
      (index) =>
        (matrix.counts[index] ?? []).some((count) => count > 0) ||
        matrix.counts.some((row) => (row[index] ?? 0) > 0),
    );
}

/**
 * Counts of class pairs as a heat map: each cell is shaded by its share of the largest count, carries the count
 * when it is not zero, and explains itself when hovered. Classes without any count are left out.
 */
export function ClassMatrixChart({
  matrix,
  classColors,
  diagonal,
  isLowerTriangle,
  rowTitle,
  columnTitle,
  cellTitleOf,
}: ClassMatrixChartProps) {
  const indices = shownIndices(matrix);
  if (indices.length === 0) return <div className="statistics-empty">Nothing to relate yet.</div>;
  const isStrictTriangle = isLowerTriangle && diagonal === "hidden";
  const rows = isStrictTriangle ? indices.slice(1) : indices;
  const columns = isStrictTriangle ? indices.slice(0, -1) : indices;
  const isCounted = (row: number, column: number) =>
    (diagonal !== "hidden" || row !== column) && (!isLowerTriangle || column <= row);
  let largest = 1;
  for (const row of rows)
    for (const column of columns)
      if (isCounted(row, column) && (diagonal === "agreement" || row !== column))
        largest = Math.max(largest, matrix.counts[row]?.[column] ?? 0);
  const nameOf = (index: number) => matrix.class_names[index] ?? "";

  return (
    <div className="class-matrix">
      {columnTitle !== undefined && <div className="class-matrix-column-title">{columnTitle}</div>}
      <div className="class-matrix-body">
        {rowTitle !== undefined && <div className="class-matrix-row-title">{rowTitle}</div>}
        <div
          className="class-matrix-grid"
          style={{ gridTemplateColumns: `minmax(72px, max-content) repeat(${columns.length}, minmax(30px, 44px))` }}
        >
          <div />
          {columns.map((column) => (
            <div key={column} className="class-matrix-column-label" title={nameOf(column)}>
              <span
                className="swatch"
                style={{ background: classColorOf(classColors, nameOf(column), SWATCH_FALLBACK_COLOR) }}
              />
              <span className="class-matrix-column-name">{nameOf(column)}</span>
            </div>
          ))}
          {rows.map((row) => (
            <div key={row} className="class-matrix-row">
              <div className="class-matrix-row-label" title={nameOf(row)}>
                <span
                  className="swatch"
                  style={{ background: classColorOf(classColors, nameOf(row), SWATCH_FALLBACK_COLOR) }}
                />
                <span className="class-matrix-row-name">{nameOf(row)}</span>
              </div>
              {columns.map((column) => {
                if (!isCounted(row, column)) return <div key={column} className="class-matrix-cell void" />;
                const count = matrix.counts[row]?.[column] ?? 0;
                const isDiagonal = row === column;
                const share = count === 0 ? 0 : Math.max(MINIMUM_FILL_SHARE, count / largest);
                const tone = isDiagonal && diagonal === "neutral" ? "neutral" : isDiagonal ? "agreement" : "heat";
                return (
                  <div
                    key={column}
                    className={`class-matrix-cell ${tone}${share > INK_SWITCH_SHARE && tone !== "neutral" ? " inverse" : ""}${count === 0 ? " zero" : ""}`}
                    style={{ "--cell-share": `${Math.round(share * 100)}%` } as CSSProperties}
                    title={cellTitleOf(nameOf(row), nameOf(column), count)}
                  >
                    {count > 0 ? formatCount(count) : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
