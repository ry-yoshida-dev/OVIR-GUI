import { type ReactNode, useState } from "react";
import type { ClassStatisticsPayload, Thresholds } from "../../api/types";
import { type ClassColors, classColorOf, SWATCH_FALLBACK_COLOR } from "../../lib/frameView";
import { formatCount, formatScore, formatShare, shareOf } from "../../lib/statisticsFormat";
import { ConfidenceStrip } from "./ConfidenceStrip";
import { ShareBar } from "./ShareBar";
import { minimumOf, REVIEW_COLORS, SIZE_COLORS } from "./statisticsColors";

type SortKey = "class" | "kept" | "review" | "pictures" | "density" | "confidence" | "size";

interface SortOrder {
  key: SortKey;
  isDescending: boolean;
}

interface ClassTableProps {
  classes: ClassStatisticsPayload[];
  recognizedCount: number;
  isClassification: boolean;
  thresholds: Thresholds;
  classColors: ClassColors;
  onFocusClass: (className: string) => void;
}

const CLASS_ORDER: SortOrder = { key: "class", isDescending: false };

function densityOf(entry: ClassStatisticsPayload): number {
  return entry.picture_count === 0 ? 0 : entry.kept_count / entry.picture_count;
}

function sortValueOf(entry: ClassStatisticsPayload, key: SortKey): number {
  switch (key) {
    case "class":
      return 0;
    case "kept":
      return entry.kept_count;
    case "review":
      return shareOf(entry.kept_count, entry.finding_count) ?? -1;
    case "pictures":
      return entry.picture_count;
    case "density":
      return densityOf(entry);
    case "confidence":
      return entry.confidences?.median ?? -1;
    case "size":
      return entry.sizes?.median_area_share ?? -1;
  }
}

function sortedClasses(classes: ClassStatisticsPayload[], order: SortOrder): ClassStatisticsPayload[] {
  if (order.key === "class") return order.isDescending ? classes.toReversed() : classes;
  return classes.toSorted((left, right) => {
    const difference = sortValueOf(left, order.key) - sortValueOf(right, order.key);
    return order.isDescending ? -difference : difference;
  });
}

/**
 * Every class in one row: how many findings it keeps, how the review treated its findings, how many pictures show
 * it, how its confidences spread against its minimum and, for instances, how large they are. Headers sort the rows
 * and a row opens the thresholds of its class.
 */
export function ClassTable({
  classes,
  recognizedCount,
  isClassification,
  thresholds,
  classColors,
  onFocusClass,
}: ClassTableProps) {
  const [order, setOrder] = useState<SortOrder>(CLASS_ORDER);
  const largestKept = Math.max(1, ...classes.map((entry) => entry.kept_count));
  const header = (key: SortKey, label: ReactNode, title: string, className = "") => (
    <th
      className={`${className}${order.key === key ? " sorted" : ""}`}
      title={title}
      aria-sort={order.key === key ? (order.isDescending ? "descending" : "ascending") : "none"}
      onClick={() =>
        setOrder((current) =>
          current.key === key
            ? { key, isDescending: !current.isDescending }
            : { key, isDescending: key !== "class" },
        )
      }
    >
      {label}
      {order.key === key && <span className="sort-mark">{order.isDescending ? "▼" : "▲"}</span>}
    </th>
  );

  return (
    <div className="class-table-scroll">
      <table className="grid statistics-class-table">
        <colgroup>
          <col style={{ width: 150 }} />
          <col style={{ width: 128 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 112 }} />
          {!isClassification && <col style={{ width: 84 }} />}
          <col style={{ minWidth: 180 }} />
          {!isClassification && <col style={{ width: 132 }} />}
        </colgroup>
        <thead>
          <tr>
            {header("class", "Class", "Class order of the class list")}
            {header("kept", isClassification ? "Labelled" : "Kept", "Findings kept by the review")}
            {header("review", "Review", "Kept, filtered out by the minimum or suppression, and rejected findings")}
            {header("pictures", "Pictures", "Pictures with a kept finding of the class, and their share")}
            {!isClassification &&
              header("density", "Per picture", "Kept findings per picture showing the class, and the most on one")}
            {header(
              "confidence",
              <>
                Confidence
                <span className="confidence-scale" aria-hidden="true">
                  <span style={{ left: "50%" }}>0.5</span>
                  <span style={{ left: "100%" }}>1</span>
                </span>
              </>,
              "Spread of the confidences of every finding: whiskers 10th–90th percentile, box the middle half, bar the median. The shaded band falls below the minimum.",
              "confidence-header",
            )}
            {!isClassification &&
              header("size", "Size", "Small (< 32²), medium (< 96²) and large objects by pixel area, and the median share of the picture")}
          </tr>
        </thead>
        <tbody>
          {sortedClasses(classes, order).map((entry) => {
            const color = classColorOf(classColors, entry.class_name, SWATCH_FALLBACK_COLOR);
            const coverage = shareOf(entry.picture_count, recognizedCount);
            return (
              <tr key={entry.class_name} className="clickable" onClick={() => onFocusClass(entry.class_name)}>
                <td>
                  <span className="class-cell">
                    <span className="swatch" style={{ background: color }} />
                    <span className="class-cell-name">{entry.class_name}</span>
                  </span>
                </td>
                <td>
                  <div className="value-bar">
                    <span className="value-bar-number">{formatCount(entry.kept_count)}</span>
                    <span className="value-bar-track">
                      <span
                        className="value-bar-fill"
                        style={{ width: `${(entry.kept_count / largestKept) * 100}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td>
                  <div className="review-cell">
                    <ShareBar
                      total={entry.finding_count}
                      segments={[
                        { key: "kept", label: "Kept", value: entry.kept_count, color: REVIEW_COLORS.kept },
                        {
                          key: "below",
                          label: "Filtered out",
                          value: entry.below_minimum_count,
                          color: REVIEW_COLORS.below,
                        },
                        { key: "rejected", label: "Rejected", value: entry.rejected_count, color: REVIEW_COLORS.rejected },
                      ]}
                    />
                    <span className="review-cell-share">{formatShare(shareOf(entry.kept_count, entry.finding_count))}</span>
                  </div>
                </td>
                <td>
                  <div className="value-bar">
                    <span className="value-bar-number">{formatCount(entry.picture_count)}</span>
                    <span className="faint small coverage-share">{formatShare(coverage)}</span>
                  </div>
                </td>
                {!isClassification && (
                  <td className="number">
                    {entry.picture_count === 0 ? (
                      <span className="faint">–</span>
                    ) : (
                      <>
                        {densityOf(entry).toFixed(1)}
                        <span className="density-peak">max {entry.peak_count}</span>
                      </>
                    )}
                  </td>
                )}
                <td>
                  <div className="confidence-cell">
                    <ConfidenceStrip
                      summary={entry.confidences}
                      minimum={minimumOf(thresholds, entry.class_name)}
                      color={color}
                    />
                    <span className="confidence-cell-median">{formatScore(entry.confidences?.median ?? null)}</span>
                  </div>
                </td>
                {!isClassification && (
                  <td>
                    {entry.sizes === null || entry.kept_count === 0 ? (
                      <span className="faint">–</span>
                    ) : (
                      <div className="size-cell">
                        <ShareBar
                          segments={[
                            { key: "small", label: "Small", value: entry.sizes.small_count, color: SIZE_COLORS.small },
                            {
                              key: "medium",
                              label: "Medium",
                              value: entry.sizes.medium_count,
                              color: SIZE_COLORS.medium,
                            },
                            { key: "large", label: "Large", value: entry.sizes.large_count, color: SIZE_COLORS.large },
                          ]}
                        />
                        <span className="size-cell-share" title="Median share of the picture">
                          {formatShare(entry.sizes.median_area_share)}
                        </span>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
