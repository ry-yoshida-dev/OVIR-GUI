import type { ResultStatisticsPayload } from "../../api/types";
import { diagonalOf, topPairsOf } from "../../lib/classPairs";
import type { ClassColors } from "../../lib/frameView";
import { countedNoun, formatScore, formatShare, shareOf } from "../../lib/statisticsFormat";
import { ClassMatrixChart } from "./ClassMatrixChart";
import { type ChartColumn, ColumnChart } from "./ColumnChart";
import { PairRanking } from "./PairRanking";
import { StatisticsCard } from "./StatisticsCard";

interface RelationsViewProps {
  statistics: ResultStatisticsPayload;
  classColors: ClassColors;
}

const RANKED_PAIR_LIMIT = 8;
const MARGIN_LABEL_EVERY = 4;

/**
 * How classes relate: for instances, which classes cover the same objects and which appear together; for
 * classifications, which class comes second to which and how close the top two scores are.
 */
export function RelationsView({ statistics, classColors }: RelationsViewProps) {
  const coOccurrence = statistics.co_occurrence;
  const picturesWith = (className: string) => diagonalOf(coOccurrence, className);
  return (
    <div className="statistics-view">
      {statistics.overlaps !== null && (
        <StatisticsCard
          title="Overlapping classes"
          description={`Kept findings of two classes covering the same object (IoU ≥ ${statistics.overlap_threshold}). Frequent pairs point to phrases that describe the same things.`}
        >
          <div className="relation-layout">
            <PairRanking
              pairs={topPairsOf(statistics.overlaps, true, RANKED_PAIR_LIMIT)}
              classColors={classColors}
              joiner="≈"
              emptyText="No two classes cover the same object."
              titleOf={(pair) => `${countedNoun(pair.count, "object")} found as both ${pair.first} and ${pair.second}`}
            />
            <ClassMatrixChart
              matrix={statistics.overlaps}
              classColors={classColors}
              diagonal="hidden"
              isLowerTriangle
              cellTitleOf={(row, column, count) =>
                `${row} ≈ ${column}: ${countedNoun(count, "overlapping pair")}`
              }
            />
          </div>
        </StatisticsCard>
      )}
      {statistics.runner_ups !== null && (
        <StatisticsCard
          title="Runner-up classes"
          description="The second-best class of every picture, by its top class. Frequent pairs are classes the model finds hard to tell apart."
        >
          <div className="relation-layout">
            <PairRanking
              pairs={topPairsOf(statistics.runner_ups, false, RANKED_PAIR_LIMIT)}
              classColors={classColors}
              joiner="then"
              emptyText="No picture has been classified yet."
              titleOf={(pair) => `${countedNoun(pair.count, "picture")} scored ${pair.first} first and ${pair.second} second`}
            />
            <ClassMatrixChart
              matrix={statistics.runner_ups}
              classColors={classColors}
              diagonal="hidden"
              isLowerTriangle={false}
              rowTitle="Top class"
              columnTitle="Runner-up"
              cellTitleOf={(row, column, count) => `${row}, then ${column}: ${countedNoun(count, "picture")}`}
            />
          </div>
        </StatisticsCard>
      )}
      {statistics.margins !== null && (
        <StatisticsCard
          title="Top-score margin"
          description="Score of the top class minus that of the runner-up. Pictures near zero could as well be the other class."
        >
          <ColumnChart
            color="var(--stat-meter)"
            height={140}
            axisLabel="Margin between the two best scores"
            columns={statistics.margins.bin_counts.map(
              (count, bin): ChartColumn => {
                const lower = bin * (statistics.margins?.bin_width ?? 0);
                const upper = lower + (statistics.margins?.bin_width ?? 0);
                return {
                  key: String(bin),
                  label: bin % MARGIN_LABEL_EVERY === 0 ? formatScore(lower) : "",
                  value: count,
                  title: `Margin ${formatScore(lower)}–${formatScore(upper)}: ${countedNoun(count, "picture")}`,
                };
              },
            )}
          />
        </StatisticsCard>
      )}
      {statistics.overlaps !== null && (
        <StatisticsCard
          title="Classes seen together"
          description="Pictures keeping findings of both classes. The diagonal counts the pictures showing each class."
        >
          <div className="relation-layout">
            <PairRanking
              pairs={topPairsOf(coOccurrence, true, RANKED_PAIR_LIMIT)}
              classColors={classColors}
              joiner="+"
              emptyText="No two classes share a picture."
              titleOf={(pair) => `${countedNoun(pair.count, "picture")} show both ${pair.first} and ${pair.second}`}
              detailOf={(pair) =>
                `${formatShare(shareOf(pair.count, picturesWith(pair.first)))} of ${pair.first} · ${formatShare(shareOf(pair.count, picturesWith(pair.second)))} of ${pair.second}`
              }
            />
            <ClassMatrixChart
              matrix={coOccurrence}
              classColors={classColors}
              diagonal="neutral"
              isLowerTriangle
              cellTitleOf={(row, column, count) =>
                row === column
                  ? `${row}: ${countedNoun(count, "picture")}`
                  : `${row} + ${column}: ${countedNoun(count, "picture")} (${formatShare(shareOf(count, picturesWith(row)))} of ${row}, ${formatShare(shareOf(count, picturesWith(column)))} of ${column})`
              }
            />
          </div>
        </StatisticsCard>
      )}
    </div>
  );
}
