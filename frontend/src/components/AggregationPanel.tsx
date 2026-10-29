import { type DragEvent, type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { AggregationMethodValue, AggregationStep, ScoreActivationValue } from "../api/types";
import {
  type AggregationRows,
  EMBEDDING_METHOD,
  type RowTiming,
  UNIT_TITLES,
  canAggregateTogether,
  isSameSteps,
  stepIndexOf,
  stepsOf,
  swapped,
  withMethod,
  withTiming,
} from "../lib/aggregationRows";
import { placeInViewport } from "../lib/viewportPlacement";
import { AggregationDiagram } from "./AggregationDiagram";
import { AggregationMethodPicker } from "./AggregationMethodPicker";
import { ResetGlyph } from "./Glyphs";

interface AggregationPanelProps {
  anchor: RefObject<HTMLElement | null>;
  aggregation: AggregationRows;
  defaultAggregation: AggregationRows;
  methods: { value: AggregationMethodValue; title: string }[];
  activation: ScoreActivationValue;
  isDisabled: boolean;
  onChange: (aggregation: AggregationRows) => void;
  onClose: () => void;
}

const PANEL_MARGINS = { near: 8, far: 8 };
const PANE_GAP = 10;
const HEADER_OFFSET = 40;
const MAX_PANEL_WIDTH = 1548;
const MIN_PANEL_WIDTH = 640;
const MIN_BESIDE_WIDTH = 1000;
const TIMINGS: { value: RowTiming; title: string }[] = [
  { value: "none", title: "None" },
  { value: "embedding", title: "① Text vectors" },
  { value: "similarity", title: "② Similarities" },
];

interface Preview {
  aggregation: AggregationRows;
  rowIndex: number | null;
}

/**
 * Panel beside the setup pane, or over it when the window is too narrow, shrinking its overview to fit the window,
 * choosing how the prompts and templates of a class become its score, above the overview
 * of the process for example classes, which follows the choice. Templates and Prompts each run at no timing, on text
 * vectors or on similarities, with a method; dragging a row by its handle runs it before the other at the same timing,
 * and both rows at the same timing can be aggregated together. Pointing at a row highlights its step in the overview,
 * and pointing at a timing, at aggregating together or at Reset shows the overview that choice gives before it is made;
 * Reset returns to the default aggregation. It closes with its close button or Escape.
 */
export function AggregationPanel({
  anchor,
  aggregation,
  defaultAggregation,
  methods,
  activation,
  isDisabled,
  onChange,
  onClose,
}: AggregationPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: MAX_PANEL_WIDTH });
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
    const place = () => {
      const field = anchor.current;
      const diagram = panel.current?.querySelector(".aggregation-diagram svg");
      if (field === null || panel.current === null || diagram === null || diagram === undefined) return;
      const pane = field.closest(".pane") ?? field;
      const panelBox = panel.current.getBoundingClientRect();
      const diagramBox = diagram.getBoundingClientRect();
      const left = pane.getBoundingClientRect().right + PANE_GAP;
      const margins = PANEL_MARGINS.near + PANEL_MARGINS.far;
      const besideWidth = window.innerWidth - left - PANEL_MARGINS.far;
      const fittingWidth = besideWidth >= MIN_BESIDE_WIDTH ? besideWidth : window.innerWidth - margins;
      const otherWidth = panelBox.width - diagramBox.width;
      const contentHeight = panel.current.scrollHeight + panel.current.offsetHeight - panel.current.clientHeight;
      const otherHeight = contentHeight - diagramBox.height;
      const heightFittingWidth =
        ((window.innerHeight - margins - otherHeight) * diagramBox.width) / diagramBox.height + otherWidth;
      const width = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, fittingWidth, heightFittingWidth));
      const height = otherHeight + ((width - otherWidth) * diagramBox.height) / diagramBox.width;
      setPosition({
        ...placeInViewport({ left, top: field.getBoundingClientRect().top - HEADER_OFFSET }, { width, height }, PANEL_MARGINS),
        width,
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor]);

  const steps: AggregationStep[] = stepsOf(aggregation);
  const isTogetherPossible = canAggregateTogether(aggregation);
  const isTogether = aggregation.isTogether && isTogetherPossible;
  const isOrderChosen = isTogetherPossible && !isTogether;

  const shownSteps: AggregationStep[] = preview === null ? steps : stepsOf(preview.aggregation);
  const shownHighlight = preview === null ? highlightedStep : previewHighlightOf(preview, shownSteps);
  const note = noteOf(steps, shownSteps);
  const isDefault = isSameSteps(steps, stepsOf(defaultAggregation));
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
        <button
          type="button"
          className="ghost small labeled-action"
          title="Reset the aggregation to its default"
          disabled={isDisabled || isDefault}
          {...(isDisabled || isDefault ? {} : previewProps(defaultAggregation, null))}
          onClick={() => {
            setPreview(null);
            onChange(defaultAggregation);
          }}
        >
          <ResetGlyph />
          Reset
        </button>
        <button className="ghost icon" title="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="aggregation-diagram">
        <AggregationDiagram steps={shownSteps} activation={activation} highlightedStep={shownHighlight} />
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
                className={isOrderChosen ? "drag-handle" : "drag-handle inactive"}
                draggable={!isDisabled && isOrderChosen}
                title={
                  isOrderChosen
                    ? "Drag to change which runs first"
                    : "The order matters when both run at the same timing, one after the other"
                }
                aria-label="Drag to change which runs first"
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
              <AggregationMethodPicker
                label={`Method of ${UNIT_TITLES[row.unit]}`}
                value={row.timing === "none" ? null : row.method}
                methods={methods.filter((method) => row.timing === "similarity" || method.value === EMBEDDING_METHOD)}
                activation={activation}
                isDisabled={isDisabled || !isMethodChosen}
                disabledTitle={disabledMethodTitleOf(row.timing, isTogether && index === 1)}
                onChoose={(method) => onChange(withMethod(aggregation, index, method))}
                onPreview={(method) =>
                  setPreview(
                    method === null
                      ? null
                      : { aggregation: withMethod(aggregation, index, method), rowIndex: index },
                  )
                }
              />
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
        <span className={note.isRerun ? "aggregation-note rerun" : "aggregation-note"}>{note.text}</span>
      </div>
    </div>
  );
}

function previewHighlightOf(preview: Preview, steps: readonly AggregationStep[]): number | null {
  if (preview.rowIndex === null) return steps.length === 1 && steps[0]?.unit === "template_and_prompt" ? 0 : null;
  const row = preview.aggregation.rows[preview.rowIndex];
  return row === undefined ? null : stepIndexOf(steps, row);
}

function noteOf(
  steps: readonly AggregationStep[],
  shownSteps: readonly AggregationStep[],
): { text: string; isRerun: boolean } {
  if (!isSameSteps(steps, shownSteps)) {
    const embeddingOf = (candidates: readonly AggregationStep[]) =>
      candidates.filter((step) => step.timing === "embedding");
    return isSameSteps(embeddingOf(steps), embeddingOf(shownSteps))
      ? { text: "This change applies at once, without a Re-run.", isRerun: false }
      : { text: "This change needs a Re-run: steps on text vectors change what the picture is compared with.", isRerun: true };
  }
  if (steps.length === 0)
    return { text: "Nothing is aggregated: every sentence is a candidate, and a class scores its best one.", isRerun: false };
  return steps.some((step) => step.timing === "embedding")
    ? {
        text: "Steps on text vectors change what the picture is compared with: changing them needs a Re-run. Steps on similarities apply at once.",
        isRerun: false,
      }
    : { text: "Every step is on similarities: changes apply at once, without a Re-run.", isRerun: false };
}

function disabledMethodTitleOf(timing: RowTiming, isFollowingTogether: boolean): string {
  if (isFollowingTogether) return "Aggregated together with the method of the first row";
  switch (timing) {
    case "none":
      return "Not aggregated";
    case "embedding":
      return "Text vectors are averaged and normalized again";
    case "similarity":
      return "";
  }
}
