import type { ResultStatisticsPayload, Thresholds } from "../../api/types";
import type { ClassColors } from "../../lib/frameView";
import { countedNoun, formatCount, formatShare, shareOf } from "../../lib/statisticsFormat";
import { ChartLegend } from "./ChartLegend";
import { ClassTable } from "./ClassTable";
import { ColumnChart } from "./ColumnChart";
import { ShareBar } from "./ShareBar";
import { StatisticsCard } from "./StatisticsCard";
import { StatTile } from "./StatTile";
import { REVIEW_COLORS, SIZE_COLORS } from "./statisticsColors";

interface OverviewViewProps {
  statistics: ResultStatisticsPayload;
  isClassification: boolean;
  thresholds: Thresholds;
  classColors: ClassColors;
  onFocusClass: (className: string) => void;
}

const AMBIGUOUS_MARGIN = 0.1;

function ambiguousCountOf(statistics: ResultStatisticsPayload): number {
  const margins = statistics.margins;
  if (margins === null) return 0;
  const binCount = Math.round(AMBIGUOUS_MARGIN / margins.bin_width);
  return margins.bin_counts.slice(0, binCount).reduce((sum, count) => sum + count, 0);
}

/**
 * Headline figures of the shown results, one row per class and how many findings the pictures keep.
 */
export function OverviewView({
  statistics,
  isClassification,
  thresholds,
  classColors,
  onFocusClass,
}: OverviewViewProps) {
  const recognized = statistics.recognized_count;
  const keptPictureCount = recognized - statistics.empty_picture_count;
  const usedClassCount = statistics.classes.filter((entry) => entry.kept_count > 0).length;
  const mostKept = statistics.picture_lists.most_kept[0]?.kept_count ?? 0;
  const distribution = statistics.kept_count_distribution;
  const lastBucket = distribution.length - 1;
  const reviewSegments = [
    { key: "kept", label: "Kept", value: statistics.kept_count, color: REVIEW_COLORS.kept },
    { key: "below", label: "Filtered out", value: statistics.below_minimum_count, color: REVIEW_COLORS.below },
    { key: "rejected", label: "Rejected", value: statistics.rejected_count, color: REVIEW_COLORS.rejected },
  ];
  const legend = [
    ...reviewSegments.map((segment) => ({ key: segment.key, label: segment.label, color: segment.color })),
    ...(isClassification
      ? []
      : [
          { key: "small", label: "Small", color: SIZE_COLORS.small },
          { key: "medium", label: "Medium", color: SIZE_COLORS.medium },
          { key: "large", label: "Large", color: SIZE_COLORS.large },
        ]),
  ];

  return (
    <div className="statistics-view">
      <div className="stat-tiles">
        <StatTile
          label="Pictures recognized"
          value={formatCount(recognized)}
          detail={`of ${countedNoun(statistics.picture_count, "picture")} · ${formatShare(shareOf(recognized, statistics.picture_count))}`}
        >
          <ShareBar
            total={statistics.picture_count}
            segments={[{ key: "recognized", label: "Recognized", value: recognized, color: "var(--stat-meter)" }]}
          />
        </StatTile>
        <StatTile
          label={isClassification ? "Labelled pictures" : "Kept findings"}
          value={formatCount(statistics.kept_count)}
          detail={`of ${formatCount(statistics.finding_count)} ${isClassification ? "classified" : "stored"} · ${formatShare(shareOf(statistics.kept_count, statistics.finding_count))}`}
          hint="Kept, filtered out by the minimum or the duplicate suppression, and rejected by you"
        >
          <ShareBar total={statistics.finding_count} segments={reviewSegments} />
        </StatTile>
        {isClassification ? (
          <StatTile
            label="Classes used"
            value={formatCount(usedClassCount)}
            detail={`of ${countedNoun(statistics.classes.length, "class", "classes")} label a picture`}
          />
        ) : (
          <StatTile
            label="Pictures with findings"
            value={formatCount(keptPictureCount)}
            detail={
              statistics.empty_picture_count === 0
                ? "every recognized picture keeps one"
                : `${countedNoun(statistics.empty_picture_count, "picture")} keep nothing`
            }
          />
        )}
        {isClassification ? (
          <StatTile
            label="Close calls"
            value={formatCount(ambiguousCountOf(statistics))}
            detail={`top two scores within ${AMBIGUOUS_MARGIN.toFixed(2)}`}
            hint="Pictures whose best and second-best class score almost alike"
          />
        ) : (
          <StatTile
            label="Findings per picture"
            value={recognized === 0 ? "–" : (statistics.kept_count / recognized).toFixed(1)}
            detail={`mean · at most ${formatCount(mostKept)} on one picture`}
          />
        )}
        <StatTile
          label="Borderline pictures"
          value={formatCount(statistics.borderline_picture_count)}
          detail={`${isClassification ? "top scores" : "findings"} within ±${statistics.borderline_margin.toFixed(2)} of their minimum`}
          hint="A small change of the minimum confidence keeps or drops findings on these pictures"
        />
      </div>
      <StatisticsCard
        title="Classes"
        description="Select a class to tune its minimum confidence."
        aside={<ChartLegend entries={legend} />}
      >
        <ClassTable
          classes={statistics.classes}
          recognizedCount={recognized}
          isClassification={isClassification}
          thresholds={thresholds}
          classColors={classColors}
          onFocusClass={onFocusClass}
        />
      </StatisticsCard>
      {!isClassification && (
        <StatisticsCard
          title="Findings per picture"
          description={`How many findings the ${formatCount(statistics.recognized_count)} recognized pictures keep.`}
        >
          <ColumnChart
            color="var(--stat-meter)"
            height={130}
            isValueShown
            axisLabel="Kept findings on one picture"
            columns={distribution.map((count, bucket) => ({
              key: String(bucket),
              label: bucket === lastBucket ? `${bucket}+` : String(bucket),
              value: count,
              title: `${countedNoun(count, "picture")} keep ${bucket === lastBucket ? `${bucket} or more` : bucket} ${bucket === 1 ? "finding" : "findings"}`,
              isMuted: bucket === 0,
            }))}
          />
        </StatisticsCard>
      )}
    </div>
  );
}
