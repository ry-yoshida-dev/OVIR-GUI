import { useEffect } from "react";
import type { ResultStatisticsPayload, Thresholds } from "../../api/types";
import { type ClassColors, classColorOf, SWATCH_FALLBACK_COLOR } from "../../lib/frameView";
import { withEntry } from "../../lib/records";
import { NumberField } from "../NumberField";
import { ChartLegend } from "./ChartLegend";
import { minimumOf } from "./statisticsColors";
import { ThresholdCurveCard } from "./ThresholdCurveCard";

interface ThresholdViewProps {
  statistics: ResultStatisticsPayload;
  isClassification: boolean;
  thresholds: Thresholds;
  classColors: ClassColors;
  focusedClass: string | null;
  onThresholdsChange: (thresholds: Thresholds) => void;
}

/**
 * One threshold curve per class, so the minimum of each class can be set where its curve flattens out.
 */
export function ThresholdView({
  statistics,
  isClassification,
  thresholds,
  classColors,
  focusedClass,
  onThresholdsChange,
}: ThresholdViewProps) {
  useEffect(() => {
    if (focusedClass === null) return;
    document.getElementById(`threshold-${focusedClass}`)?.scrollIntoView({ block: "nearest" });
  }, [focusedClass]);
  const setClassMinimum = (className: string, value: number | null) =>
    onThresholdsChange({ ...thresholds, class_minimums: withEntry(thresholds.class_minimums, className, value) });

  return (
    <div className="statistics-view">
      <div className="threshold-toolbar">
        <label className="threshold-default">
          <span>Default minimum</span>
          <NumberField
            value={thresholds.default_minimum}
            step={0.01}
            onCommit={(value) => onThresholdsChange({ ...thresholds, default_minimum: value })}
            width={72}
          />
        </label>
        <ChartLegend
          entries={[
            {
              key: "findings",
              label: isClassification ? "Pictures labelled with the class, in its color" : "Findings kept, in the class color",
              color: "var(--text)",
              isLine: true,
            },
            ...(isClassification
              ? []
              : [{ key: "pictures", label: "Pictures showing the class", color: "var(--curve-pictures)", isLine: true }]),
          ]}
        />
        <span className="threshold-toolbar-note">
          Counts at each minimum, before duplicate suppression. Drag a curve or use the arrow keys to set the minimum
          of its class; double-click to go back to the default.
        </span>
      </div>
      <div className="threshold-grid">
        {statistics.classes.map((entry) => (
          <ThresholdCurveCard
            key={entry.class_name}
            entry={entry}
            stepCount={statistics.threshold_step_count}
            color={classColorOf(classColors, entry.class_name, SWATCH_FALLBACK_COLOR)}
            minimum={minimumOf(thresholds, entry.class_name)}
            isOwnMinimum={thresholds.class_minimums[entry.class_name] !== undefined}
            isFocused={entry.class_name === focusedClass}
            isClassification={isClassification}
            onMinimumChange={(value) => setClassMinimum(entry.class_name, value)}
            onReset={() => setClassMinimum(entry.class_name, null)}
          />
        ))}
      </div>
    </div>
  );
}
