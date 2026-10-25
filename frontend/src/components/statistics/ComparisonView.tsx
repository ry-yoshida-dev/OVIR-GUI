import type { ClassComparisonPayload, Profile, ProfileComparisonPayload } from "../../api/types";
import { type ClassColors, classColorOf, SWATCH_FALLBACK_COLOR } from "../../lib/frameView";
import { countedNoun, formatCount, formatScore, formatShare, shareOf } from "../../lib/statisticsFormat";
import { ChartLegend } from "./ChartLegend";
import { ClassMatrixChart } from "./ClassMatrixChart";
import { PictureList } from "./PictureList";
import { ShareBar } from "./ShareBar";
import { StatisticsCard } from "./StatisticsCard";
import { StatTile } from "./StatTile";
import { COMPARISON_COLORS } from "./statisticsColors";

interface ComparisonViewProps {
  comparison: ProfileComparisonPayload | null;
  isClassification: boolean;
  shownModel: string | null;
  comparedModel: string | null;
  profiles: Profile[];
  shownKey: string | null;
  comparedKey: string | null;
  classColors: ClassColors;
  onCompare: (key: string | null) => void;
  onOpenPicture: (path: string, frame: number | null) => void;
}

interface ComparisonTotals {
  shown: number;
  compared: number;
  matched: number;
  overlapSum: number;
}

function totalsOf(classes: ClassComparisonPayload[]): ComparisonTotals {
  return classes.reduce(
    (totals, entry) => ({
      shown: totals.shown + entry.shown_count,
      compared: totals.compared + entry.compared_count,
      matched: totals.matched + entry.matched_count,
      overlapSum: totals.overlapSum + (entry.mean_matched_overlap ?? 0) * entry.matched_count,
    }),
    { shown: 0, compared: 0, matched: 0, overlapSum: 0 },
  );
}

function unionOf(entry: ClassComparisonPayload): number {
  return entry.shown_count + entry.compared_count - entry.matched_count;
}

function profileLabelOf(profile: Profile): string {
  return `${profile.backend}/${profile.model_name} (${profile.options_text})`;
}

/**
 * Where the shown model and another one agree, class by class and picture by picture, on the kept findings of the
 * pictures both recognized.
 */
export function ComparisonView({
  comparison,
  isClassification,
  shownModel,
  comparedModel,
  profiles,
  shownKey,
  comparedKey,
  classColors,
  onCompare,
  onOpenPicture,
}: ComparisonViewProps) {
  const candidates = profiles.filter((profile) => profile.key !== shownKey);
  const picker = (
    <div className="comparison-picker">
      <span className="comparison-model">
        <span className="chart-key-swatch" style={{ background: COMPARISON_COLORS.shown }} />
        <span className="comparison-model-role">Shown</span>
        <span className="comparison-model-name">{shownModel ?? "–"}</span>
      </span>
      <span className="comparison-versus">vs</span>
      <span className="comparison-model">
        <span className="chart-key-swatch" style={{ background: COMPARISON_COLORS.compared }} />
        <span className="comparison-model-role">Compared</span>
        <select
          value={comparedKey ?? ""}
          disabled={candidates.length === 0}
          onChange={(event) => onCompare(event.target.value === "" ? null : event.target.value)}
        >
          <option value="">{candidates.length === 0 ? "No other model has results" : "Choose a model…"}</option>
          {candidates.map((profile) => (
            <option key={profile.key} value={profile.key}>
              {profileLabelOf(profile)}
            </option>
          ))}
        </select>
      </span>
    </div>
  );

  if (comparison === null)
    return (
      <div className="statistics-view">
        {picker}
        <div className="statistics-placeholder">
          <strong>Compare two models</strong>
          <span>
            {candidates.length === 0
              ? "Run another model on the same pictures; its results appear in the Models list and can be compared here."
              : "Choose a model above to see, class by class, which findings both keep and which only one of them finds."}
          </span>
        </div>
      </div>
    );

  const totals = totalsOf(comparison.classes);
  const union = totals.shown + totals.compared - totals.matched;
  const rows = comparison.classes.filter((entry) => unionOf(entry) > 0);
  const largestUnion = Math.max(1, ...rows.map(unionOf));
  const findingNoun = isClassification ? "label" : "finding";

  return (
    <div className="statistics-view">
      {picker}
      <div className="stat-tiles">
        <StatTile
          label="Pictures compared"
          value={formatCount(comparison.picture_count)}
          detail="recognized by both models"
        />
        <StatTile
          label="Agreement"
          value={formatShare(shareOf(totals.matched, union))}
          detail={`${formatCount(totals.matched)} of ${countedNoun(union, findingNoun)} found by both`}
          hint="Matched findings over the findings of either model"
        >
          <ShareBar
            segments={[
              { key: "compared", label: "Only compared", value: totals.compared - totals.matched, color: COMPARISON_COLORS.compared },
              { key: "matched", label: "Both", value: totals.matched, color: COMPARISON_COLORS.matched },
              { key: "shown", label: "Only shown", value: totals.shown - totals.matched, color: COMPARISON_COLORS.shown },
            ]}
          />
        </StatTile>
        <StatTile
          label="Only shown"
          value={formatCount(totals.shown - totals.matched)}
          detail={`of ${countedNoun(totals.shown, findingNoun)} of ${shownModel ?? "the shown model"}`}
        />
        <StatTile
          label="Only compared"
          value={formatCount(totals.compared - totals.matched)}
          detail={`of ${countedNoun(totals.compared, findingNoun)} of ${comparedModel ?? "the compared model"}`}
        />
        {isClassification ? (
          <StatTile
            label="Pictures that differ"
            value={formatCount(comparison.disagreeing_picture_count)}
            detail={formatShare(shareOf(comparison.disagreeing_picture_count, comparison.picture_count))}
          />
        ) : (
          <StatTile
            label="Mean IoU of matches"
            value={totals.matched === 0 ? "–" : formatScore(totals.overlapSum / totals.matched)}
            detail={`pairs need IoU ≥ ${comparison.iou_threshold}`}
            hint="How tightly the boxes or masks of matched findings line up"
          />
        )}
      </div>
      <StatisticsCard
        title="Agreement by class"
        description={
          isClassification
            ? "Pictures labelled with the class by both models, by only one, or by neither."
            : `Kept findings paired one to one by overlap (IoU ≥ ${comparison.iou_threshold}); bars share one scale.`
        }
        aside={
          <ChartLegend
            entries={[
              { key: "compared", label: "Only compared", color: COMPARISON_COLORS.compared },
              { key: "matched", label: "Both", color: COMPARISON_COLORS.matched },
              { key: "shown", label: "Only shown", color: COMPARISON_COLORS.shown },
            ]}
          />
        }
      >
        {rows.length === 0 ? (
          <div className="statistics-empty">Neither model keeps a finding on the pictures both recognized.</div>
        ) : (
          <div className="class-table-scroll">
            <table className="grid statistics-class-table comparison-class-table">
              <colgroup>
                <col style={{ width: 150 }} />
                <col style={{ minWidth: 220 }} />
                <col style={{ width: 84 }} />
                {!isClassification && <col style={{ width: 84 }} />}
                <col style={{ width: 80 }} />
                <col style={{ width: 96 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Found by</th>
                  <th className="number" title="Matched over the findings of either model">
                    Agreement
                  </th>
                  {!isClassification && (
                    <th className="number" title="Mean intersection over union of the matched pairs">
                      IoU
                    </th>
                  )}
                  <th className="number">Shown</th>
                  <th className="number">Compared</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.class_name}>
                    <td>
                      <span className="class-cell">
                        <span
                          className="swatch"
                          style={{ background: classColorOf(classColors, entry.class_name, SWATCH_FALLBACK_COLOR) }}
                        />
                        <span className="class-cell-name">{entry.class_name}</span>
                      </span>
                    </td>
                    <td>
                      <div className="comparison-bar" style={{ width: `${(unionOf(entry) / largestUnion) * 100}%` }}>
                        <ShareBar
                          height={10}
                          segments={[
                            {
                              key: "compared",
                              label: "Only compared",
                              value: entry.compared_only_count,
                              color: COMPARISON_COLORS.compared,
                            },
                            { key: "matched", label: "Both", value: entry.matched_count, color: COMPARISON_COLORS.matched },
                            { key: "shown", label: "Only shown", value: entry.shown_only_count, color: COMPARISON_COLORS.shown },
                          ]}
                        />
                      </div>
                    </td>
                    <td className="number">{formatShare(entry.agreement)}</td>
                    {!isClassification && <td className="number">{formatScore(entry.mean_matched_overlap)}</td>}
                    <td className="number">{formatCount(entry.shown_count)}</td>
                    <td className="number">{formatCount(entry.compared_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StatisticsCard>
      {comparison.confusion !== null && (
        <StatisticsCard
          title="Labels of both models"
          description="Pictures by the class each model labels them with. The diagonal is where they agree."
        >
          <ClassMatrixChart
            matrix={comparison.confusion}
            classColors={classColors}
            diagonal="agreement"
            isLowerTriangle={false}
            rowTitle="Shown model"
            columnTitle="Compared model"
            cellTitleOf={(row, column, count) =>
              row === column
                ? `Both label ${countedNoun(count, "picture")} ${row}`
                : `${countedNoun(count, "picture")}: shown says ${row}, compared says ${column}`
            }
          />
        </StatisticsCard>
      )}
      <StatisticsCard
        title="Pictures where they differ most"
        description="Open a picture and turn on the compared model in the view settings to see both side by side."
      >
        <PictureList
          items={comparison.pictures.map((picture) => ({
            key: `${picture.path}#${picture.frame ?? ""}`,
            path: picture.path,
            frame: picture.frame,
            label: picture.label,
            classNames: [],
            summary: (
              <span className="comparison-picture-summary">
                <span className="comparison-count" title="Only the shown model">
                  <span className="chart-key-swatch" style={{ background: COMPARISON_COLORS.shown }} />
                  {formatCount(picture.shown_only_count)}
                </span>
                <span className="comparison-count" title="Only the compared model">
                  <span className="chart-key-swatch" style={{ background: COMPARISON_COLORS.compared }} />
                  {formatCount(picture.compared_only_count)}
                </span>
                <span className="comparison-count" title="Both">
                  <span className="chart-key-swatch" style={{ background: COMPARISON_COLORS.matched }} />
                  {formatCount(picture.matched_count)}
                </span>
              </span>
            ),
            value: formatCount(picture.shown_only_count + picture.compared_only_count),
            detail: "unmatched",
            share:
              (picture.shown_only_count + picture.compared_only_count) /
              Math.max(1, ...comparison.pictures.map((entry) => entry.shown_only_count + entry.compared_only_count)),
          }))}
          classColors={classColors}
          classesLabel="Only shown · only compared · both"
          valueLabel="Differences"
          emptyText="Both models keep the same findings on every picture."
          onOpenPicture={onOpenPicture}
        />
        {comparison.disagreeing_picture_count > comparison.pictures.length && (
          <div className="statistics-footnote">
            The first {formatCount(comparison.pictures.length)} of{" "}
            {countedNoun(comparison.disagreeing_picture_count, "picture")}.
          </div>
        )}
      </StatisticsCard>
    </div>
  );
}
