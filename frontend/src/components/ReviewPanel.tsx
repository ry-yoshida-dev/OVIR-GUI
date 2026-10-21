import { useMemo, useState } from "react";
import type {
  ClassEntry,
  DuplicateSuppression,
  ResultsPayload,
  Thresholds,
} from "../api/types";
import { ConfidenceOverview } from "../lib/confidenceOverview";
import type { BelowMinimumStyle } from "../lib/displayOptions";
import { FALLBACK_CLASS_COLOR } from "../lib/frameView";
import { OverlapOverview } from "../lib/overlapOverview";
import {
  REVIEW_MODE_ORDER,
  type ReviewModeValue,
  reviewModeOf,
} from "../lib/reviewModes";
import type { ReviewFilter } from "../lib/reviewFilter";
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
  belowMinimum: BelowMinimumStyle;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onThresholdsChange: (thresholds: Thresholds) => void;
  onSuppressionChange: (suppression: DuplicateSuppression) => void;
  onBelowMinimumChange: (belowMinimum: BelowMinimumStyle) => void;
}

const OVERALL_COLOR = "var(--accent)";

function isSameValue(left: number, right: number, step: number): boolean {
  return Math.abs(left - right) < step / 2;
}

function withoutKey(
  record: Record<string, number>,
  key: string,
): Record<string, number> {
  const { [key]: _removed, ...rest } = record;
  return rest;
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
  belowMinimum,
  isCollapsed,
  onToggleCollapsed,
  onThresholdsChange,
  onSuppressionChange,
  onBelowMinimumChange,
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
    setExpandedClasses((current) => {
      const next = new Set(current);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });

  const setClassMinimum = (className: string, minimum: number | null) =>
    onThresholdsChange({
      ...thresholds,
      class_minimums:
        minimum === null
          ? withoutKey(thresholds.class_minimums, className)
          : { ...thresholds.class_minimums, [className]: minimum },
    });

  const setPhraseMinimum = (
    className: string,
    phrase: string,
    minimum: number | null,
  ) => {
    const current = thresholds.phrase_minimums[className] ?? {};
    const byPhrase =
      minimum === null
        ? withoutKey(current, phrase)
        : { ...current, [phrase]: minimum };
    const phraseMinimums = { ...thresholds.phrase_minimums };
    if (Object.keys(byPhrase).length === 0) delete phraseMinimums[className];
    else phraseMinimums[className] = byPhrase;
    onThresholdsChange({ ...thresholds, phrase_minimums: phraseMinimums });
  };

  const setClassOverlap = (className: string, overlap: number | null) =>
    onSuppressionChange({
      ...suppression,
      class_overlap_thresholds:
        overlap === null
          ? withoutKey(suppression.class_overlap_thresholds, className)
          : { ...suppression.class_overlap_thresholds, [className]: overlap },
    });

  const confidenceRows = () => {
    const isDeparted = !isSameValue(
      thresholds.default_minimum,
      standardMinimum,
      mode.step,
    );
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
          isExpandable={false}
          isExpanded={false}
          isDisabled={false}
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
          onToggleExpanded={() => undefined}
        />
        {confidences.classes.map((entry) => {
          const ownMinimum = thresholds.class_minimums[entry.className];
          const classThreshold = reviewFilter.minimumOf(entry.className);
          const isExpandable = entry.phrases.length > 1;
          const isExpanded =
            isExpandable && expandedClasses.has(entry.className);
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
                isDisabled={false}
                resetLabel="Follow All Classes"
                onChange={(value) => setClassMinimum(entry.className, value)}
                onReset={
                  ownMinimum === undefined
                    ? null
                    : () => setClassMinimum(entry.className, null)
                }
                onToggleExpanded={() => toggleExpanded(entry.className)}
              />
              {isExpanded &&
                entry.phrases.map((phrase) => {
                  const ownPhraseMinimum =
                    thresholds.phrase_minimums[entry.className]?.[
                      phrase.phrase
                    ];
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
                      isExpandable={false}
                      isExpanded={false}
                      isDisabled={false}
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
                      onToggleExpanded={() => undefined}
                    />
                  );
                })}
            </div>
          );
        })}
      </>
    );
  };

  const overlapRows = (overview: OverlapOverview) => {
    const isDisabled = !suppression.is_enabled;
    const isDeparted = !isSameValue(
      suppression.overlap_threshold,
      standardOverlap,
      mode.step,
    );
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
          isExpandable={false}
          isExpanded={false}
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
          onToggleExpanded={() => undefined}
        />
        {confidences.classes.map((entry) => {
          const ownOverlap =
            suppression.class_overlap_thresholds[entry.className];
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
              isExpandable={false}
              isExpanded={false}
              isDisabled={isDisabled}
              resetLabel="Follow All Classes"
              onChange={(value) => setClassOverlap(entry.className, value)}
              onReset={
                ownOverlap === undefined
                  ? null
                  : () => setClassOverlap(entry.className, null)
              }
              onToggleExpanded={() => undefined}
            />
          );
        })}
      </>
    );
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
        <button
          type="button"
          className="ghost small"
          title={
            belowMinimum === "dim"
              ? "Findings below their threshold or removed as duplicates are dimmed; click to hide them"
              : "Findings below their threshold or removed as duplicates are hidden; click to dim them instead"
          }
          onClick={() =>
            onBelowMinimumChange(belowMinimum === "dim" ? "hide" : "dim")
          }
        >
          {belowMinimum === "dim"
            ? "Filtered out: Dimmed"
            : "Filtered out: Hidden"}
        </button>
        <span className="muted small">{confidences.overallKeptCount} kept</span>
      </ResultsHeading>
      {!isCollapsed && (
        <div className="review-rows">
          {shownModeValue === "overlap" && overlaps !== null
            ? overlapRows(overlaps)
            : confidenceRows()}
        </div>
      )}
    </div>
  );
}
