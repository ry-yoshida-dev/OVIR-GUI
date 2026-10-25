import { type DragEvent, type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { AggregationMethodValue, AggregationStep } from "../api/types";
import {
  type AggregationRows,
  EMBEDDING_METHOD,
  type RowTiming,
  UNIT_TITLES,
  canAggregateTogether,
  stepIndexOf,
  stepsOf,
  swapped,
  withMethod,
  withTiming,
} from "../lib/aggregationRows";
import { placeInViewport } from "../lib/viewportPlacement";
import { AggregationDiagram } from "./AggregationDiagram";

interface AggregationPanelProps {
  anchor: RefObject<HTMLElement | null>;
  aggregation: AggregationRows;
  methods: { value: AggregationMethodValue; title: string }[];
  isDisabled: boolean;
  onChange: (aggregation: AggregationRows) => void;
  onClose: () => void;
}

const PANEL_MARGINS = { near: 8, far: 8 };
const PANE_GAP = 10;
const HEADER_OFFSET = 40;
const TIMINGS: { value: RowTiming; title: string }[] = [
  { value: "none", title: "None" },
  { value: "embedding", title: "① Text vectors" },
  { value: "similarity", title: "② Similarities" },
];
const NO_METHOD = "—";

interface Preview {
  aggregation: AggregationRows;
  rowIndex: number | null;
}

/**
 * Panel beside the setup pane choosing how the prompts and templates of a class become its score, above the overview
 * of the process for example classes, which follows the choice. Templates and Prompts each run at no timing, on text
 * vectors or on similarities, with a method; dragging a row by its handle runs it before the other at the same timing,
 * and both rows at the same timing can be aggregated together. Pointing at a row highlights its step in the overview,
 * and pointing at a timing or at aggregating together shows the overview that choice gives before it is made.
 * It closes with its close button or Escape.
 */
export function AggregationPanel({ anchor, aggregation, methods, isDisabled, onChange, onClose }: AggregationPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [highlightedStep, setHighlightedStep] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useLayoutEffect(() => {
    const field = anchor.current;
    if (field === null || panel.current === null) return;
    const pane = field.closest(".pane") ?? field;
    setPosition(
      placeInViewport(
        {
          left: pane.getBoundingClientRect().right + PANE_GAP,
          top: field.getBoundingClientRect().top - HEADER_OFFSET,
        },
        panel.current.getBoundingClientRect(),
        PANEL_MARGINS,
      ),
    );
  }, [anchor]);

  const steps: AggregationStep[] = stepsOf(aggregation);
  const isTogetherPossible = canAggregateTogether(aggregation);
  const isTogether = aggregation.isTogether && isTogetherPossible;
  const hasEmbedding = steps.some((step) => step.timing === "embedding");
  const note =
    steps.length === 0
      ? "Nothing is aggregated: every sentence is a candidate, and a class scores its best one."
      : hasEmbedding
        ? "Steps on text vectors change what the picture is compared with: changing them needs a Re-run. Steps on similarities apply at once."
        : "Every step is on similarities: changes apply at once, without a Re-run.";

  const shownSteps: AggregationStep[] = preview === null ? steps : stepsOf(preview.aggregation);
  const shownHighlight = preview === null ? highlightedStep : previewHighlightOf(preview, shownSteps);
  const previewProps = (next: AggregationRows, rowIndex: number | null) => ({
    onMouseEnter: () => setPreview({ aggregation: next, rowIndex }),
    onMouseLeave: () => setPreview(null),
  });

  const highlightProps = (stepIndex: number | null) => ({
    onMouseEnter: () => setHighlightedStep(stepIndex),
    onMouseLeave: () => setHighlightedStep(null),
  });
  const dropProps = (index: number) => ({
    onDragOver: (event: DragEvent) => {
      if (draggedIndex === null || draggedIndex === index) return;
      event.preventDefault();
      setDropIndex(index);
    },
    onDragLeave: () => setDropIndex(null),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) onChange(swapped(aggregation));
      setDraggedIndex(null);
      setDropIndex(null);
    },
  });

  return (
    <div
      ref={panel}
      className="popover aggregation-panel"
      role="dialog"
      aria-label="Aggregation"
      style={position}
    >
      <div className="template-panel-header">
        <span className="popover-title">Aggregation</span>
        <span className="small muted">How the prompts and templates of a class become its score</span>
        <span className="grow" />
        <button className="ghost icon" title="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="aggregation-diagram">
        <AggregationDiagram steps={shownSteps} highlightedStep={shownHighlight} />
      </div>
      <div className="aggregation-controls">
        <span className="aggregation-heading">Unit</span>
        <span className="aggregation-heading">Timing</span>
        <span className="aggregation-heading">Method</span>
        <span />
        {aggregation.rows.map((row, index) => {
          const stepIndex = stepIndexOf(steps, row);
          const isHighlighted = stepIndex !== null && stepIndex === highlightedStep;
          const isDropTarget = dropIndex === index;
          const rowClass = `${isHighlighted ? " hl" : ""}${isDropTarget ? " drop-target" : ""}`;
          const isMethodChosen = row.timing === "similarity" && !(isTogether && index === 1);
          return [
            <span
              key={`${row.unit}-label`}
              className={`aggregation-row-label${rowClass}`}
              {...highlightProps(stepIndex)}
              {...dropProps(index)}
            >
              <span
                className="drag-handle"
                draggable={!isDisabled}
                title="Drag to change the order"
                aria-label="Drag to change the order"
                onDragStart={(event) => {
                  setDraggedIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDropIndex(null);
                }}
              >
                ⠿
              </span>
              {UNIT_TITLES[row.unit]}
            </span>,
            <div
              key={`${row.unit}-controls`}
              className={`aggregation-row${rowClass}`}
              {...highlightProps(stepIndex)}
              {...dropProps(index)}
            >
              <span className="segmented" role="radiogroup" aria-label={`Timing of ${UNIT_TITLES[row.unit]}`}>
                {TIMINGS.map((timing) => (
                  <button
                    key={timing.value}
                    type="button"
                    role="radio"
                    aria-checked={row.timing === timing.value}
                    className={row.timing === timing.value ? "active" : ""}
                    disabled={isDisabled}
                    {...previewProps(withTiming(aggregation, index, timing.value), index)}
                    onClick={() => onChange(withTiming(aggregation, index, timing.value))}
                  >
                    {timing.title}
                  </button>
                ))}
              </span>
              <select
                className="aggregation-method"
                aria-label={`Method of ${UNIT_TITLES[row.unit]}`}
                value={row.timing === "none" ? NO_METHOD : row.method}
                disabled={isDisabled || !isMethodChosen}
                onChange={(event) =>
                  onChange(withMethod(aggregation, index, event.target.value as AggregationMethodValue))
                }
              >
                {row.timing === "none" ? (
                  <option value={NO_METHOD}>{NO_METHOD}</option>
                ) : (
                  methods
                    .filter((method) => row.timing === "similarity" || method.value === EMBEDDING_METHOD)
                    .map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.title}
                      </option>
                    ))
                )}
              </select>
            </div>,
          ];
        })}
        <label
          className="aggregation-together"
          title={isTogetherPossible ? undefined : "Choose the same timing for templates and prompts"}
          {...(isDisabled || !isTogetherPossible
            ? {}
            : previewProps({ ...aggregation, isTogether: !isTogether }, null))}
        >
          <input
            type="checkbox"
            checked={isTogether}
            disabled={isDisabled || !isTogetherPossible}
            onChange={(event) => onChange({ ...aggregation, isTogether: event.target.checked })}
          />
          Aggregate templates and prompts together
        </label>
        <span className="aggregation-note">{note}</span>
      </div>
    </div>
  );
}

function previewHighlightOf(preview: Preview, steps: readonly AggregationStep[]): number | null {
  if (preview.rowIndex === null) return steps.length === 1 && steps[0]?.unit === "template_and_prompt" ? 0 : null;
  const row = preview.aggregation.rows[preview.rowIndex];
  return row === undefined ? null : stepIndexOf(steps, row);
}
