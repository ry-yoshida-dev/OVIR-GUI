import { useState } from "react";
import { api, errorMessage } from "../../api/client";
import type { Profile, StatisticsPayload, Thresholds } from "../../api/types";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useStoredState } from "../../hooks/useStoredState";
import type { ClassColors } from "../../lib/frameView";
import { countedNoun, formatCount } from "../../lib/statisticsFormat";
import { DEFAULT_TASK, taskViewOf } from "../../lib/taskViews";
import { Dialog } from "../Dialog";
import { ComparisonView } from "./ComparisonView";
import { OverviewView } from "./OverviewView";
import { PicturesView } from "./PicturesView";
import { RelationsView } from "./RelationsView";
import { ThresholdView } from "./ThresholdView";
import "./Statistics.css";

type StatisticsView = "overview" | "thresholds" | "relations" | "pictures" | "comparison";

interface StatisticsLayout {
  view: StatisticsView;
}

interface StatisticsNavEntry {
  view: StatisticsView;
  label: string;
  descriptionOf: (payload: StatisticsPayload) => string;
}

interface StatisticsDialogProps {
  refreshToken: string;
  thresholds: Thresholds;
  classColors: ClassColors;
  profiles: Profile[];
  shownKey: string | null;
  comparedKey: string | null;
  onThresholdsChange: (thresholds: Thresholds) => void;
  onCompare: (key: string | null) => void;
  onOpenPicture: (path: string, frame: number | null) => void;
  onClose: () => void;
}

const STATISTICS_DEBOUNCE_MILLISECONDS = 150;
const DEFAULT_LAYOUT: StatisticsLayout = { view: "overview" };

const NAV_ENTRIES: StatisticsNavEntry[] = [
  {
    view: "overview",
    label: "Overview",
    descriptionOf: (payload) =>
      payload.statistics === null ? "Classes at a glance" : countedNoun(payload.statistics.classes.length, "class", "classes"),
  },
  {
    view: "thresholds",
    label: "Thresholds",
    descriptionOf: () => "What each minimum keeps",
  },
  {
    view: "relations",
    label: "Relations",
    descriptionOf: (payload) =>
      payload.task === "classification" ? "Runner-ups and margins" : "Overlaps and co-occurrence",
  },
  {
    view: "pictures",
    label: "Pictures",
    descriptionOf: () => "Pictures worth a look",
  },
  {
    view: "comparison",
    label: "Comparison",
    descriptionOf: (payload) => (payload.compared_model === null ? "Against another model" : `vs ${payload.compared_model}`),
  },
];

/**
 * Statistics of the shown results in one window: an overview of every class, the threshold curves, how classes
 * relate, pictures worth a look and the comparison with another model.
 */
export function StatisticsDialog({
  refreshToken,
  thresholds,
  classColors,
  profiles,
  shownKey,
  comparedKey,
  onThresholdsChange,
  onCompare,
  onOpenPicture,
  onClose,
}: StatisticsDialogProps) {
  const [error, setError] = useState("");
  const [layout, setLayout] = useStoredState<StatisticsLayout>("ovir-gui.statistics", DEFAULT_LAYOUT);
  const [focusedClass, setFocusedClass] = useState<string | null>(null);
  const payload = useAsyncResource(refreshToken, api.statistics, {
    debounceMilliseconds: STATISTICS_DEBOUNCE_MILLISECONDS,
    onLoaded: () => setError(""),
    onError: (caught) => setError(errorMessage(caught)),
  });
  const taskView = taskViewOf(payload?.task ?? DEFAULT_TASK);
  const isClassification = payload?.task === "classification";
  const statistics = payload?.statistics ?? null;
  const openPicture = (path: string, frame: number | null) => {
    onOpenPicture(path, frame);
    onClose();
  };
  const select = (view: StatisticsView) => {
    if (view !== "thresholds") setFocusedClass(null);
    setLayout({ view });
  };

  const content = (() => {
    if (payload === null) return <div className="statistics-placeholder">Loading statistics…</div>;
    if (layout.view === "comparison")
      return (
        <ComparisonView
          comparison={payload.comparison}
          isClassification={isClassification}
          shownModel={payload.model}
          comparedModel={payload.compared_model}
          profiles={profiles}
          shownKey={shownKey}
          comparedKey={comparedKey}
          classColors={classColors}
          onCompare={onCompare}
          onOpenPicture={openPicture}
        />
      );
    if (statistics === null || statistics.recognized_count === 0)
      return (
        <div className="statistics-placeholder">
          <strong>No results yet</strong>
          <span>Recognize pictures with a model; their {taskView.findingNoun} are analysed here as they arrive.</span>
        </div>
      );
    switch (layout.view) {
      case "overview":
        return (
          <OverviewView
            statistics={statistics}
            isClassification={isClassification}
            thresholds={thresholds}
            classColors={classColors}
            onFocusClass={(className) => {
              setFocusedClass(className);
              setLayout({ view: "thresholds" });
            }}
          />
        );
      case "thresholds":
        return (
          <ThresholdView
            statistics={statistics}
            isClassification={isClassification}
            thresholds={thresholds}
            classColors={classColors}
            focusedClass={focusedClass}
            onThresholdsChange={onThresholdsChange}
          />
        );
      case "relations":
        return <RelationsView statistics={statistics} classColors={classColors} />;
      case "pictures":
        return (
          <PicturesView
            statistics={statistics}
            isClassification={isClassification}
            classColors={classColors}
            onOpenPicture={openPicture}
          />
        );
    }
  })();

  return (
    <Dialog
      className="statistics-dialog"
      width="min(1240px, calc(100vw - 48px))"
      height="calc(100vh - 64px)"
      onClose={onClose}
      title={
        <span className="statistics-title">
          <span>Statistics</span>
          {payload !== null && (
            <span className="statistics-scope">
              <span className="statistics-scope-task">{taskView.label}</span>
              <span className="statistics-scope-model">{payload.model ?? "No results shown"}</span>
              {statistics !== null && (
                <span className="statistics-scope-count">
                  {formatCount(statistics.recognized_count)} of {countedNoun(statistics.picture_count, "picture")}{" "}
                  recognized
                </span>
              )}
            </span>
          )}
        </span>
      }
    >
      <nav className="statistics-nav" aria-label="Statistics views">
        {NAV_ENTRIES.map((entry) => (
          <button
            key={entry.view}
            className={`statistics-nav-entry${entry.view === layout.view ? " active" : ""}`}
            aria-current={entry.view === layout.view ? "page" : undefined}
            onClick={() => select(entry.view)}
          >
            <span className="statistics-nav-label">{entry.label}</span>
            {payload !== null && <span className="statistics-nav-description">{entry.descriptionOf(payload)}</span>}
          </button>
        ))}
      </nav>
      <div className="statistics-content">
        {error !== "" && <div className="error-text">{error}</div>}
        {content}
      </div>
    </Dialog>
  );
}
