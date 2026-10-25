import { useMemo, useState } from "react";
import type {
  ClassEntry,
  DuplicateSuppression,
  ResultsPayload,
  Thresholds,
} from "../api/types";
import { ConfidenceOverview } from "../lib/confidenceOverview";
import { FALLBACK_CLASS_COLOR } from "../lib/frameView";
import { OverlapOverview } from "../lib/overlapOverview";
import { withEntry } from "../lib/records";
import type { ReviewFilter } from "../lib/reviewFilter";
import {
  REVIEW_MODE_ORDER,
  type ReviewMode,
  type ReviewModeValue,
  reviewModeOf,
} from "../lib/reviewModes";
import { toggledMembership } from "../lib/sets";
import { ResetGlyph } from "./Glyphs";
import { DistributionChartRow } from "./DistributionChartRow";
import { ResultsHeading } from "./ResultsHeading";
import { ScoreChartRow } from "./ScoreChartRow";

interface ReviewPanelProps {
  classes: ClassEntry[];
  results: ResultsPayload | null;
  reviewFilter: ReviewFilter;
  thresholds: Thresholds;
  suppression: DuplicateSuppression;
  standardMinimum: number;
  standardOverlap: number;
  isScoreBased: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onThresholdsChange: (thresholds: Thresholds) => void;
  onSuppressionChange: (suppression: DuplicateSuppression) => void;
}

interface ConfidenceChartRowsProps {
  mode: ReviewMode;
  confidences: ConfidenceOverview;
  reviewFilter: ReviewFilter;
  thresholds: Thresholds;
  standardMinimum: number;
  expandedClasses: ReadonlySet<string>;
  colorOf: (className: string) => string;
  onToggleExpanded: (className: string) => void;
  onThresholdsChange: (thresholds: Thresholds) => void;
}

interface SimilarityChartRowsProps {
  mode: ReviewMode;
  similarities: ConfidenceOverview;
  expandedClasses: ReadonlySet<string>;
  colorOf: (className: string) => string;
  onToggleExpanded: (className: string) => void;
}

interface OverlapChartRowsProps {
  mode: ReviewMode;
  overview: OverlapOverview;
  confidences: ConfidenceOverview;
  reviewFilter: ReviewFilter;
  suppression: DuplicateSuppression;
  standardOverlap: number;
  colorOf: (className: string) => string;
  onSuppressionChange: (suppression: DuplicateSuppression) => void;
}

const OVERALL_COLOR = "var(--overall-series)";

function isSameValue(left: number, right: number, step: number): boolean {
  return Math.abs(left - right) < step / 2;
}

function ConfidenceChartRows({
  mode,
  confidences,
  reviewFilter,
  thresholds,
  standardMinimum,
  expandedClasses,
  colorOf,
  onToggleExpanded,
  onThresholdsChange,
}: ConfidenceChartRowsProps) {
  const isDeparted = !isSameValue(
    thresholds.default_minimum,
    standardMinimum,
    mode.step,
  );
  const setClassMinimum = (className: string, minimum: number | null) =>
    onThresholdsChange({
      ...thresholds,
      class_minimums: withEntry(thresholds.class_minimums, className, minimum),
    });
  const setPromptMinimum = (
    className: string,
    prompt: string,
    minimum: number | null,
  ) => {
    const byPrompt = withEntry(
      thresholds.prompt_minimums[className] ?? {},
      prompt,
      minimum,
    );
    onThresholdsChange({
      ...thresholds,
      prompt_minimums: withEntry(
        thresholds.prompt_minimums,
        className,
        Object.keys(byPrompt).length === 0 ? null : byPrompt,
      ),
    });
  };
  return (
    <>
      <ScoreChartRow
        title="All classes"
        level="overall"
        mode={mode}
        color={OVERALL_COLOR}
        histogram={confidences.overall}
        threshold={thresholds.default_minimum}
        parentThreshold={isDeparted ? standardMinimum : null}
        isOwn={false}
        keptCount={confidences.overallKeptCount}
        resetLabel="Reset to Default"
        onChange={(value) =>
          onThresholdsChange({ ...thresholds, default_minimum: value })
        }
        onReset={
          isDeparted
            ? () =>
                onThresholdsChange({
                  ...thresholds,
                  default_minimum: standardMinimum,
                })
            : null
        }
      />
      {confidences.classes.map((entry) => {
        const ownMinimum = thresholds.class_minimums[entry.className];
        const classThreshold = reviewFilter.minimumOf(entry.className);
        const isExpandable = entry.prompts.length > 1;
        const isExpanded = isExpandable && expandedClasses.has(entry.className);
        const color = colorOf(entry.className);
        return (
          <div key={entry.className} className="score-chart-group">
            <ScoreChartRow
              title={entry.className}
              level="class"
              mode={mode}
              color={color}
              histogram={entry.histogram}
              threshold={classThreshold}
              parentThreshold={
                ownMinimum === undefined ? null : thresholds.default_minimum
              }
              isOwn={ownMinimum !== undefined}
              keptCount={entry.keptCount}
              isExpandable={isExpandable}
              isExpanded={isExpanded}
              resetLabel="Follow All Classes"
              onChange={(value) => setClassMinimum(entry.className, value)}
              onReset={
                ownMinimum === undefined
                  ? null
                  : () => setClassMinimum(entry.className, null)
              }
              onToggleExpanded={() => onToggleExpanded(entry.className)}
            />
            {isExpanded &&
              entry.prompts.map((prompt) => {
                const ownPromptMinimum =
                  thresholds.prompt_minimums[entry.className]?.[prompt.prompt];
                return (
                  <ScoreChartRow
                    key={prompt.prompt}
                    title={prompt.prompt}
                    level="prompt"
                    mode={mode}
                    color={color}
                    histogram={prompt.histogram}
                    threshold={reviewFilter.minimumOf(
                      entry.className,
                      prompt.prompt,
                    )}
                    parentThreshold={
                      ownPromptMinimum === undefined ? null : classThreshold
                    }
                    isOwn={ownPromptMinimum !== undefined}
                    keptCount={prompt.keptCount}
                    resetLabel="Follow Class"
                    onChange={(value) =>
                      setPromptMinimum(entry.className, prompt.prompt, value)
                    }
                    onReset={
                      ownPromptMinimum === undefined
                        ? null
                        : () =>
                            setPromptMinimum(
                              entry.className,
                              prompt.prompt,
                              null,
                            )
                    }
                  />
                );
              })}
          </div>
        );
      })}
    </>
  );
}

function SimilarityChartRows({
  mode,
  similarities,
  expandedClasses,
  colorOf,
  onToggleExpanded,
}: SimilarityChartRowsProps) {
  if (similarities.measuredCount === 0) {
    return (
      <div className="hint">
        No similarities recorded yet; infer again to chart them.
      </div>
    );
  }
  return (
    <>
      <DistributionChartRow
        title="All classes"
        level="overall"
        color={OVERALL_COLOR}
        histogram={similarities.overall}
        hint={mode.valueHint}
        keptCount={similarities.overallKeptCount}
      />
      {similarities.classes.map((entry) => {
        const isExpandable = entry.prompts.length > 1;
        const isExpanded = isExpandable && expandedClasses.has(entry.className);
        const color = colorOf(entry.className);
        return (
          <div key={entry.className} className="score-chart-group">
            <DistributionChartRow
              title={entry.className}
              level="class"
              color={color}
              histogram={entry.histogram}
              hint={mode.valueHint}
              keptCount={entry.keptCount}
              isExpandable={isExpandable}
              isExpanded={isExpanded}
              onToggleExpanded={() => onToggleExpanded(entry.className)}
            />
            {isExpanded &&
              entry.prompts.map((prompt) => (
                <DistributionChartRow
                  key={prompt.prompt}
                  title={prompt.prompt}
                  level="prompt"
                  color={color}
                  histogram={prompt.histogram}
                  hint={mode.valueHint}
                  keptCount={prompt.keptCount}
                />
              ))}
          </div>
        );
      })}
    </>
  );
}

function OverlapChartRows({
  mode,
  overview,
  confidences,
  reviewFilter,
  suppression,
  standardOverlap,
  colorOf,
  onSuppressionChange,
}: OverlapChartRowsProps) {
  const isDisabled = !suppression.is_enabled;
  const isDeparted = !isSameValue(
    suppression.overlap_threshold,
    standardOverlap,
    mode.step,
  );
  const setClassOverlap = (className: string, overlap: number | null) =>
    onSuppressionChange({
      ...suppression,
      class_overlap_thresholds: withEntry(
        suppression.class_overlap_thresholds,
        className,
        overlap,
      ),
    });
  return (
    <>
      <ScoreChartRow
        title="All classes"
        level="overall"
        mode={mode}
        color={OVERALL_COLOR}
        histogram={overview.overall}
        threshold={suppression.overlap_threshold}
        parentThreshold={isDeparted ? standardOverlap : null}
        isOwn={false}
        keptCount={confidences.overallKeptCount}
        isDisabled={isDisabled}
        resetLabel="Reset to Default"
        onChange={(value) =>
          onSuppressionChange({ ...suppression, overlap_threshold: value })
        }
        onReset={
          isDeparted
            ? () =>
                onSuppressionChange({
                  ...suppression,
                  overlap_threshold: standardOverlap,
                })
            : null
        }
      />
      {confidences.classes.map((entry) => {
        const ownOverlap = suppression.class_overlap_thresholds[entry.className];
        return (
          <ScoreChartRow
            key={entry.className}
            title={entry.className}
            level="class"
            mode={mode}
            color={colorOf(entry.className)}
            histogram={overview.histogramOf(entry.className)}
            threshold={reviewFilter.overlapThresholdOf(entry.className)}
            parentThreshold={
              ownOverlap === undefined ? null : suppression.overlap_threshold
            }
            isOwn={ownOverlap !== undefined}
            keptCount={entry.keptCount}
            isDisabled={isDisabled}
            resetLabel="Follow All Classes"
            onChange={(value) => setClassOverlap(entry.className, value)}
            onReset={
              ownOverlap === undefined
                ? null
                : () => setClassOverlap(entry.className, null)
            }
          />
        );
      })}
    </>
  );
}

export function ReviewPanel({
  classes,
  results,
  reviewFilter,
  thresholds,
  suppression,
  standardMinimum,
  standardOverlap,
  isScoreBased,
  isCollapsed,
  onToggleCollapsed,
  onThresholdsChange,
  onSuppressionChange,
}: ReviewPanelProps) {
  const [modeValue, setModeValue] = useState<ReviewModeValue>("confidence");
  const [expandedClasses, setExpandedClasses] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const availableModeValues = REVIEW_MODE_ORDER.filter((value) => {
    switch (value) {
      case "confidence":
        return true;
      case "similarity":
        return isScoreBased;
      case "overlap":
        return !isScoreBased;
    }
  });
  const shownModeValue: ReviewModeValue = availableModeValues.includes(
    modeValue,
  )
    ? modeValue
    : "confidence";
  const mode = reviewModeOf(shownModeValue);
  const colorOf = (className: string): string =>
    classes.find((entry) => entry.name === className)?.color ??
    FALLBACK_CLASS_COLOR;

  const classPrompts = useMemo(
    () =>
      new Map(
        classes.map(
          (entry) =>
            [
              entry.name,
              [
                ...entry.phrases,
                ...entry.references.map((reference) => reference.name),
              ],
            ] as const,
        ),
      ),
    [classes],
  );
  const confidences = useMemo(
    () => ConfidenceOverview.of(results, classPrompts),
    [results, classPrompts],
  );
  const similarities = useMemo(
    () =>
      shownModeValue === "similarity" && !isCollapsed
        ? ConfidenceOverview.of(results, classPrompts, "similarity")
        : null,
    [shownModeValue, isCollapsed, results, classPrompts],
  );
  const overlaps = useMemo(
    () =>
      shownModeValue === "overlap" && !isCollapsed
        ? OverlapOverview.of(results, reviewFilter)
        : null,
    [shownModeValue, isCollapsed, results, reviewFilter],
  );

  const toggleExpanded = (className: string) =>
    setExpandedClasses((current) => toggledMembership(current, className));

  const isConfidenceDeparted =
    !isSameValue(thresholds.default_minimum, standardMinimum, mode.step) ||
    Object.keys(thresholds.class_minimums).length > 0 ||
    Object.keys(thresholds.prompt_minimums).length > 0;
  const isOverlapDeparted =
    !isSameValue(suppression.overlap_threshold, standardOverlap, mode.step) ||
    Object.keys(suppression.class_overlap_thresholds).length > 0;
  const isShownModeDeparted = (() => {
    switch (shownModeValue) {
      case "confidence":
        return isConfidenceDeparted;
      case "similarity":
        return false;
      case "overlap":
        return isOverlapDeparted;
    }
  })();

  const resetShownMode = () => {
    switch (shownModeValue) {
      case "confidence":
        onThresholdsChange({
          default_minimum: standardMinimum,
          class_minimums: {},
          prompt_minimums: {},
        });
        break;
      case "similarity":
        break;
      case "overlap":
        onSuppressionChange({
          ...suppression,
          overlap_threshold: standardOverlap,
          class_overlap_thresholds: {},
        });
        break;
    }
  };

  return (
    <div className="review-panel">
      <ResultsHeading
        title="Review"
        isCollapsed={isCollapsed}
        onToggle={onToggleCollapsed}
      >
        {!isCollapsed && (
          <div
            className="segmented review-tabs"
            role="tablist"
            aria-label="Review charts"
          >
            {availableModeValues.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={value === shownModeValue}
                className={value === shownModeValue ? "active" : ""}
                onClick={() => setModeValue(value)}
              >
                {reviewModeOf(value).title}
              </button>
            ))}
          </div>
        )}
        <span className="grow" />
        {!isCollapsed && shownModeValue === "overlap" && (
          <label
            className="review-switch"
            title="Remove boxes of a class overlapping a higher-scored one"
          >
            <input
              type="checkbox"
              checked={suppression.is_enabled}
              onChange={(event) =>
                onSuppressionChange({
                  ...suppression,
                  is_enabled: event.target.checked,
                })
              }
            />
            Remove duplicates
          </label>
        )}
        {!isCollapsed && shownModeValue !== "similarity" && (
          <button
            type="button"
            className="ghost small labeled-action"
            title={`Reset every ${mode.title} threshold to its default`}
            disabled={!isShownModeDeparted}
            onClick={resetShownMode}
          >
            <ResetGlyph />
            Reset
          </button>
        )}
        <span className="muted small">{confidences.overallKeptCount} kept</span>
      </ResultsHeading>
      {!isCollapsed && (
        <div className="review-rows">
          {shownModeValue === "similarity" && similarities !== null ? (
            <SimilarityChartRows
              mode={mode}
              similarities={similarities}
              expandedClasses={expandedClasses}
              colorOf={colorOf}
              onToggleExpanded={toggleExpanded}
            />
          ) : shownModeValue === "overlap" && overlaps !== null ? (
            <OverlapChartRows
              mode={mode}
              overview={overlaps}
              confidences={confidences}
              reviewFilter={reviewFilter}
              suppression={suppression}
              standardOverlap={standardOverlap}
              colorOf={colorOf}
              onSuppressionChange={onSuppressionChange}
            />
          ) : (
            <ConfidenceChartRows
              mode={mode}
              confidences={confidences}
              reviewFilter={reviewFilter}
              thresholds={thresholds}
              standardMinimum={standardMinimum}
              expandedClasses={expandedClasses}
              colorOf={colorOf}
              onToggleExpanded={toggleExpanded}
              onThresholdsChange={onThresholdsChange}
            />
          )}
        </div>
      )}
    </div>
  );
}
