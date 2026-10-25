import { useState } from "react";
import type { PictureStatisticsPayload, ResultStatisticsPayload } from "../../api/types";
import type { ClassColors } from "../../lib/frameView";
import { countedNoun, formatCount, formatScore } from "../../lib/statisticsFormat";
import { type PictureListItem, PictureList } from "./PictureList";
import { StatisticsCard } from "./StatisticsCard";

type PictureFocus = "most_kept" | "empty" | "borderline" | "ambiguous";

interface PictureFocusView {
  focus: PictureFocus;
  label: string;
  description: string;
  valueLabel: string;
  emptyText: string;
}

interface PicturesViewProps {
  statistics: ResultStatisticsPayload;
  isClassification: boolean;
  classColors: ClassColors;
  onOpenPicture: (path: string, frame: number | null) => void;
}

const DETECTION_FOCUSES: PictureFocusView[] = [
  {
    focus: "most_kept",
    label: "Most findings",
    description: "Crowded pictures, where missed and duplicated objects are most likely.",
    valueLabel: "Kept",
    emptyText: "No picture keeps a finding.",
  },
  {
    focus: "empty",
    label: "Nothing kept",
    description: "Pictures keeping no finding, those closest to keeping one first.",
    valueLabel: "Best confidence",
    emptyText: "Every recognized picture keeps a finding.",
  },
  {
    focus: "borderline",
    label: "Borderline",
    description: "Pictures with findings just above or below their minimum, which a small change keeps or drops.",
    valueLabel: "Borderline",
    emptyText: "No finding lies near its minimum.",
  },
];

const CLASSIFICATION_FOCUSES: PictureFocusView[] = [
  {
    focus: "ambiguous",
    label: "Close calls",
    description: "Pictures whose two best classes score almost alike.",
    valueLabel: "Margin",
    emptyText: "No picture has been classified yet.",
  },
  {
    focus: "empty",
    label: "Unlabelled",
    description: "Pictures whose top score stays below the minimum, those closest to it first.",
    valueLabel: "Top score",
    emptyText: "Every recognized picture is labelled.",
  },
  {
    focus: "borderline",
    label: "Borderline",
    description: "Pictures whose top score lies just above or below the minimum.",
    valueLabel: "Top score",
    emptyText: "No top score lies near the minimum.",
  },
];

function itemOf(picture: PictureStatisticsPayload, focus: PictureFocus, isClassification: boolean, largest: number): PictureListItem {
  const base = {
    key: `${picture.path}#${picture.frame ?? ""}`,
    path: picture.path,
    frame: picture.frame,
    label: picture.label,
    classNames: picture.kept_class_names,
  };
  switch (focus) {
    case "most_kept":
      return {
        ...base,
        value: formatCount(picture.kept_count),
        detail: `of ${formatCount(picture.finding_count)}`,
        share: picture.kept_count / largest,
      };
    case "empty":
      return {
        ...base,
        value: formatScore(picture.best_confidence),
        detail: isClassification ? "" : countedNoun(picture.finding_count, "finding"),
        share: picture.best_confidence ?? 0,
      };
    case "borderline":
      return {
        ...base,
        value: isClassification ? formatScore(picture.best_confidence) : formatCount(picture.borderline_count),
        detail: isClassification ? "" : `${formatCount(picture.kept_count)} kept`,
        share: isClassification ? (picture.best_confidence ?? 0) : picture.borderline_count / largest,
      };
    case "ambiguous":
      return {
        ...base,
        value: formatScore(picture.top_margin),
        detail: "",
        share: 1 - (picture.top_margin ?? 1),
      };
  }
}

function largestOf(pictures: PictureStatisticsPayload[], focus: PictureFocus): number {
  const values = pictures.map((picture) => (focus === "borderline" ? picture.borderline_count : picture.kept_count));
  return Math.max(1, ...values);
}

function totalOf(statistics: ResultStatisticsPayload, focus: PictureFocus): number {
  switch (focus) {
    case "most_kept":
      return statistics.recognized_count - statistics.empty_picture_count;
    case "empty":
      return statistics.empty_picture_count;
    case "borderline":
      return statistics.borderline_picture_count;
    case "ambiguous":
      return statistics.recognized_count;
  }
}

/**
 * Lists of pictures worth a look, each opening in the image view.
 */
export function PicturesView({ statistics, isClassification, classColors, onOpenPicture }: PicturesViewProps) {
  const focuses = isClassification ? CLASSIFICATION_FOCUSES : DETECTION_FOCUSES;
  const [chosen, setChosen] = useState<PictureFocus | null>(null);
  const shown = focuses.find((entry) => entry.focus === chosen) ?? focuses[0];
  if (shown === undefined) return null;
  const pictures = statistics.picture_lists[shown.focus];
  const largest = largestOf(pictures, shown.focus);
  const total = totalOf(statistics, shown.focus);

  return (
    <div className="statistics-view">
      <StatisticsCard
        title="Pictures to look at"
        description={shown.description}
        aside={
          <div className="segmented statistics-segmented" role="tablist">
            {focuses.map((entry) => (
              <button
                key={entry.focus}
                role="tab"
                aria-selected={entry.focus === shown.focus}
                className={entry.focus === shown.focus ? "active" : ""}
                onClick={() => setChosen(entry.focus)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        }
      >
        <PictureList
          items={pictures.map((picture) => itemOf(picture, shown.focus, isClassification, largest))}
          classColors={classColors}
          valueLabel={shown.valueLabel}
          emptyText={shown.emptyText}
          onOpenPicture={onOpenPicture}
        />
        {total > pictures.length && (
          <div className="statistics-footnote">
            The first {formatCount(pictures.length)} of {countedNoun(total, "picture")}.
          </div>
        )}
      </StatisticsCard>
    </div>
  );
}
