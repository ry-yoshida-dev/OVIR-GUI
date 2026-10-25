import { Fragment, useRef, useState } from "react";
import type {
  BackendEntry,
  ModelBenchmark,
  ModelState,
  PresetEntry,
} from "../api/types";
import { familyOf } from "../lib/modelFamily";
import { promptInputKindsOf, promptInputsAcross } from "../lib/promptInputs";
import { Dialog } from "./Dialog";
import { type BenchmarkPoint, ModelBenchmarkChart } from "./ModelBenchmarkChart";

type SortKey = "catalog" | "lvis_ap" | "gflops";

interface ModelRow {
  key: string;
  backend: string;
  family: string;
  preset: PresetEntry;
  groupIndex: number;
  catalogIndex: number;
}

interface SortOrder {
  key: SortKey;
  isAscending: boolean;
}

interface ModelLibraryDialogProps {
  model: ModelState;
  backends: BackendEntry[];
  onSelectPreset: (backend: string, presetName: string) => void;
  onClose: () => void;
}

const VALIDATION_MARK = "*";
const TRAINED_ON_LVIS_MARK = "†";

function sortValueOf(row: ModelRow, key: SortKey): number | null {
  switch (key) {
    case "catalog":
      return null;
    case "lvis_ap":
      return row.preset.benchmark?.lvis_ap ?? null;
    case "gflops":
      return row.preset.benchmark?.gflops ?? null;
  }
}

function sortedRows(rows: ModelRow[], order: SortOrder): ModelRow[] {
  return rows.toSorted((left, right) => {
    if (left.groupIndex !== right.groupIndex)
      return left.groupIndex - right.groupIndex;
    const leftValue = sortValueOf(left, order.key);
    const rightValue = sortValueOf(right, order.key);
    if (leftValue !== null && rightValue !== null && leftValue !== rightValue)
      return order.isAscending
        ? leftValue - rightValue
        : rightValue - leftValue;
    if (leftValue !== null && rightValue === null) return -1;
    if (leftValue === null && rightValue !== null) return 1;
    return left.catalogIndex - right.catalogIndex;
  });
}

function formattedAccuracy(benchmark: ModelBenchmark | null): string {
  if (benchmark?.lvis_ap == null) return "—";
  return (
    benchmark.lvis_ap.toFixed(1) +
    (benchmark.lvis_split === "val" ? VALIDATION_MARK : "") +
    (benchmark.is_lvis_zero_shot ? "" : TRAINED_ON_LVIS_MARK)
  );
}

/**
 * Every preset of the current task in one table, grouped by segmentation mode when the task has several, sortable by
 * accuracy and compute within each group; clicking a row selects it.
 */
export function ModelLibraryDialog({
  model,
  backends,
  onSelectPreset,
  onClose,
}: ModelLibraryDialogProps) {
  const [order, setOrder] = useState<SortOrder>({
    key: "catalog",
    isAscending: true,
  });
  const isGrouped = model.modes.length > 1;
  const groupIndexOf = (backend: BackendEntry) =>
    isGrouped
      ? model.modes.findIndex((mode) => mode.value === backend.mode)
      : 0;
  const rows: ModelRow[] = backends
    .flatMap((backend) =>
      backend.presets.map((preset) => ({
        key: `${backend.value}/${preset.name}`,
        backend: backend.value,
        family: familyOf(backend.value),
        preset,
        groupIndex: groupIndexOf(backend),
      })),
    )
    .map((row, catalogIndex) => ({ ...row, catalogIndex }));
  const inputs = promptInputsAcross(rows.map((row) => row.preset));
  const isBenchmarked = rows.some((row) => row.preset.benchmark !== null);
  const headerRowSpan = inputs.length > 0 ? 2 : 1;
  const columnCount = 2 + inputs.length + (isBenchmarked ? 2 : 0);
  const selection = model.selection;
  const currentKey = `${selection.backend}/${selection.preset_name}`;
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const tableWrap = useRef<HTMLDivElement>(null);
  const plottedRows = rows.filter(
    (row) =>
      row.preset.benchmark?.lvis_ap != null &&
      row.preset.benchmark.gflops != null,
  );
  const families = [...new Set(plottedRows.map((row) => row.family))];
  const points: BenchmarkPoint[] = plottedRows.map((row) => ({
    key: row.key,
    family: row.family,
    familySlot: families.indexOf(row.family),
    presetName: row.preset.name,
    lvisAp: row.preset.benchmark?.lvis_ap ?? 0,
    gflops: row.preset.benchmark?.gflops ?? 0,
  }));

  const choose = (row: ModelRow) => {
    onClose();
    if (row.key !== currentKey) onSelectPreset(row.backend, row.preset.name);
  };
  const hoverFromChart = (key: string | null) => {
    setHoveredKey(key);
    if (key === null) return;
    tableWrap.current
      ?.querySelector(`tr[data-key="${CSS.escape(key)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  const sortBy = (key: SortKey) =>
    setOrder((current) =>
      current.key === key && key !== "catalog"
        ? { key, isAscending: !current.isAscending }
        : { key, isAscending: key !== "lvis_ap" },
    );
  const sortHeader = (key: SortKey, label: string, className?: string) => (
    <th
      className={className}
      rowSpan={headerRowSpan}
      title={
        key === "catalog"
          ? "Click to return to the catalog order"
          : "Click to sort; click again to reverse"
      }
      aria-sort={
        order.key !== key || key === "catalog"
          ? "none"
          : order.isAscending
            ? "ascending"
            : "descending"
      }
      onClick={() => sortBy(key)}
    >
      {label}
      {order.key === key &&
        key !== "catalog" &&
        (order.isAscending ? " ▴" : " ▾")}
    </th>
  );

  return (
    <Dialog
      title="Models"
      onClose={onClose}
      width={isBenchmarked ? 960 : 800}
      height={isBenchmarked && points.length > 0 ? 860 : 620}
    >
      {points.length > 0 && (
        <ModelBenchmarkChart
          points={points}
          families={families}
          currentKey={currentKey}
          hoveredKey={hoveredKey}
          onHover={hoverFromChart}
          onChoose={(key) => {
            const row = rows.find((candidate) => candidate.key === key);
            if (row !== undefined) choose(row);
          }}
        />
      )}
      <div ref={tableWrap} className="table-wrap model-library-table">
        <table className="grid">
          <colgroup>
            <col style={{ width: 210 }} />
            {inputs.map((input) => (
              <col key={input.kind} style={{ width: 72 }} />
            ))}
            {isBenchmarked && <col style={{ width: 76 }} />}
            {isBenchmarked && <col style={{ width: 76 }} />}
            <col style={{ width: 340 }} />
          </colgroup>
          <thead>
            <tr>
              {sortHeader("catalog", "Model")}
              {inputs.length > 0 && (
                <th
                  className="static-header input-group-header"
                  colSpan={inputs.length}
                >
                  Supported prompts
                </th>
              )}
              {isBenchmarked && sortHeader("lvis_ap", "LVIS AP", "number")}
              {isBenchmarked && sortHeader("gflops", "GFLOPs", "number")}
              <th className="static-header" rowSpan={headerRowSpan}>
                Weights
              </th>
            </tr>
            {inputs.length > 0 && (
              <tr>
                {inputs.map((input) => (
                  <th
                    key={input.kind}
                    className="static-header input-header"
                    title={input.hint}
                  >
                    {input.label}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {sortedRows(rows, order).map((row, rowIndex, shownRows) => {
              const isCurrent = row.key === currentKey;
              const isGroupStart =
                isGrouped &&
                (rowIndex === 0 ||
                  shownRows[rowIndex - 1]?.groupIndex !== row.groupIndex);
              const classNames = [
                isCurrent ? "current" : "",
                row.key === hoveredKey ? "is-hovered" : "",
              ].filter((name) => name !== "");
              return (
                <Fragment key={row.key}>
                  {isGroupStart && (
                    <tr className="model-group-row">
                      <td colSpan={columnCount}>
                        {model.modes[row.groupIndex]?.title}
                      </td>
                    </tr>
                  )}
                  <tr
                    data-key={row.key}
                    className={classNames.join(" ") || undefined}
                    aria-selected={isCurrent}
                    onMouseEnter={() => setHoveredKey(row.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() => choose(row)}
                  >
                    <td className="model-library-name">
                      <div className="small muted">{row.family}</div>
                      <div className={isCurrent ? "is-current-preset" : undefined}>
                        {row.preset.name}
                        {row.preset.licenses.length > 0 && (
                          <span
                            className="badge warning"
                            title={`Needs ${row.preset.licenses.join(", ")}`}
                          >
                            {row.preset.licenses.join(", ")}
                          </span>
                        )}
                      </div>
                    </td>
                    {inputs.map((input, inputIndex) => {
                      const isAccepted = promptInputKindsOf(row.preset).has(
                        input.kind,
                      );
                      return (
                        <td
                          key={input.kind}
                          className={
                            inputIndex === inputs.length - 1
                              ? "input-check is-group-end"
                              : "input-check"
                          }
                          aria-label={isAccepted ? input.label : undefined}
                        >
                          {isAccepted ? "✓" : ""}
                        </td>
                      );
                    })}
                    {isBenchmarked && (
                      <td className="number">
                        {formattedAccuracy(row.preset.benchmark)}
                      </td>
                    )}
                    {isBenchmarked && (
                      <td className="number">
                        {row.preset.benchmark?.gflops?.toFixed(0) ?? "—"}
                      </td>
                    )}
                    <td className="mono small muted" title={row.preset.weights_path}>
                      {row.preset.weights_path}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {isBenchmarked && (
        <div className="small muted model-library-notes">
          <div>
            <b>LVIS AP</b> Zero-shot box AP on LVIS minival from the paper or
            model card of the checkpoint; — when not reported.{" "}
            {VALIDATION_MARK} LVIS v1.0 val, which scores lower than minival.{" "}
            {TRAINED_ON_LVIS_MARK} LVIS was used in training, so not zero-shot.
          </div>
          <div>
            <b>GFLOPs</b> Theoretical compute of one detection of{" "}
            {model.benchmark_phrase_count} phrases on the Hugging Face model;
            fewer is faster. Florence-2 writes its boxes as text, so each further
            box adds decoding.
          </div>
        </div>
      )}
    </Dialog>
  );
}
