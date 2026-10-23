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
  isOverlapAvailable: boolean;
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
  const setPhraseMinimum = (
    className: string,
    phrase: string,
    minimum: number | null,
  ) => {
    const byPhrase = withEntry(
      thresholds.phrase_minimums[className] ?? {},
      phrase,
      minimum,
    );
    onThresholdsChange({
      ...thresholds,
      phrase_minimums: withEntry(
        thresholds.phrase_minimums,
        className,
        Object.keys(byPhrase).length === 0 ? null : byPhrase,
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
        const isExpandable = entry.phrases.length > 1;
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
              entry.phrases.map((phrase) => {
                const ownPhraseMinimum =
                  thresholds.phrase_minimums[entry.className]?.[phrase.phrase];
                return (
                  <ScoreChartRow
                    key={phrase.phrase}
                    title={phrase.phrase}
                    level="phrase"
                    mode={mode}
                    color={color}
                    histogram={phrase.histogram}
                    threshold={reviewFilter.minimumOf(
                      entry.className,
                      phrase.phrase,
                    )}
                    parentThreshold={
                      ownPhraseMinimum === undefined ? null : classThreshold
                    }
                    isOwn={ownPhraseMinimum !== undefined}
                    keptCount={phrase.keptCount}
                    resetLabel="Follow Class"
                    onChange={(value) =>
                      setPhraseMinimum(entry.className, phrase.phrase, value)
                    }
                    onReset={
                      ownPhraseMinimum === undefined
                        ? null
                        : () =>
                            setPhraseMinimum(
                              entry.className,
                              phrase.phrase,
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
  isOverlapAvailable,
  isCollapsed,
  onToggleCollapsed,
  onThresholdsChange,
  onSuppressionChange,
}: ReviewPanelProps) {
  const [modeValue, setModeValue] = useState<ReviewModeValue>("confidence");
  const [expandedClasses, setExpandedClasses] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const shownModeValue: ReviewModeValue = isOverlapAvailable
    ? modeValue
    : "confidence";
  const mode = reviewModeOf(shownModeValue);
  const colorOf = (className: string): string =>
    classes.find((entry) => entry.name === className)?.color ??
    FALLBACK_CLASS_COLOR;

  const classPhrases = useMemo(
    () => new Map(classes.map((entry) => [entry.name, entry.phrases] as const)),
    [classes],
  );
  const confidences = useMemo(
    () => ConfidenceOverview.of(results, classPhrases),
    [results, classPhrases],
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
    Object.keys(thresholds.phrase_minimums).length > 0;
  const isOverlapDeparted =
    !isSameValue(suppression.overlap_threshold, standardOverlap, mode.step) ||
    Object.keys(suppression.class_overlap_thresholds).length > 0;
  const isShownModeDeparted =
    shownModeValue === "overlap" ? isOverlapDeparted : isConfidenceDeparted;

  const resetShownMode = () => {
    switch (shownModeValue) {
      case "confidence":
        onThresholdsChange({
          default_minimum: standardMinimum,
          class_minimums: {},
          phrase_minimums: {},
        });
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
            {REVIEW_MODE_ORDER.filter(
              (value) => value === "confidence" || isOverlapAvailable,
            ).map((value) => (
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
        {!isCollapsed && (
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
          {shownModeValue === "overlap" && overlaps !== null ? (
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
