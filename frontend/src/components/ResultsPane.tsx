import { api } from "../api/client";
import type {
  CurrentPicture,
  MediaEntry,
  ResultsPayload,
  TaskValue,
  WorkspaceState,
} from "../api/types";
import type { Call, RunAction } from "../hooks/useActionRunner";
import type { LayoutState } from "../hooks/useLayoutState";
import type { ResultRows } from "../hooks/useResultRows";
import type { ReviewDraft } from "../hooks/useReviewDraft";
import type { FrameResultIndex } from "../lib/frameResultIndex";
import type { ClassColors } from "../lib/frameView";
import type { PlaybackPosition } from "../lib/playbackPosition";
import type { TableRow } from "../lib/resultTable";
import type { TaskView } from "../lib/taskViews";
import { ExportGlyph, FindingsGlyph, StatisticsGlyph } from "./Glyphs";
import { PaneHeader } from "./PaneHeader";
import { ProfileTable } from "./ProfileTable";
import { ResultTable } from "./ResultTable";
import { ReviewPanel } from "./ReviewPanel";
import { Section } from "./Section";
import { Splitter } from "./Splitter";
import { VideoFindingsPanel } from "./VideoFindingsPanel";

interface ResultsPaneProps {
  state: WorkspaceState;
  task: TaskValue;
  taskView: TaskView;
  layoutState: LayoutState;
  review: ReviewDraft;
  markedResults: ResultsPayload | null;
  resultRows: ResultRows;
  isImageResultsShown: boolean;
  hasVideos: boolean;
  resultPictureKey: string | null;
  classColors: ClassColors;
  chartedVideo: MediaEntry | null;
  chartedCurrent: CurrentPicture | null;
  chartedVideoResults: FrameResultIndex | null;
  position: PlaybackPosition;
  isVideoPlayerUsed: boolean;
  call: Call;
  runAction: RunAction;
  onToggleStatistics: () => void;
  onOpenExport: () => void;
  onSelectRow: (row: TableRow) => void;
  onSetAccepted: (rows: TableRow[], isAccepted: boolean) => void;
  onSeekChartedVideo: (frame: number, isFinal: boolean) => void;
}

/**
 * Right pane listing the stored inference profiles, the review charts and the result tables.
 */
export function ResultsPane({
  state,
  task,
  taskView,
  layoutState,
  review,
  markedResults,
  resultRows,
  isImageResultsShown,
  hasVideos,
  resultPictureKey,
  classColors,
  chartedVideo,
  chartedCurrent,
  chartedVideoResults,
  position,
  isVideoPlayerUsed,
  call,
  runAction,
  onToggleStatistics,
  onOpenExport,
  onSelectRow,
  onSetAccepted,
  onSeekChartedVideo,
}: ResultsPaneProps) {
  const { layout, isCollapsed, toggleSection, resize } = layoutState;
  const { reviewFilter } = review;
  return (
    <div className="pane" style={{ width: layout.rightWidth, flex: "none" }}>
      <PaneHeader title="Results">
        <button
          className="sheet-button"
          onClick={onToggleStatistics}
          title="Statistics and class minimums (Ctrl+I)"
        >
          <StatisticsGlyph />
          Statistics
        </button>
        <button
          className="sheet-button"
          disabled={state.is_busy}
          onClick={onOpenExport}
          title="Export results or download the listed findings as CSV (Ctrl+E)"
        >
          <ExportGlyph />
          Export
        </button>
      </PaneHeader>
      <div
        className="pane-region"
        style={
          isCollapsed("models")
            ? { flex: "none" }
            : isCollapsed("results")
              ? undefined
              : { height: layout.profileHeight, flex: "none" }
        }
      >
        <ProfileTable
          profiles={state.profiles}
          shownKey={state.shown_profile_key}
          comparedKey={state.compared_profile_key}
          onSelect={(key) => void call(() => api.selectProfile(key))}
          onRemove={(keys) => void call(() => api.removeProfiles(keys))}
          isBusy={state.is_busy}
          isCollapsed={isCollapsed("models")}
          onToggleCollapsed={() => toggleSection("models")}
          onUpdateOutdated={() => void runAction(api.updateOutdated)}
        />
      </div>
      {!isCollapsed("models") && !isCollapsed("results") && (
        <Splitter
          isHorizontal
          onResize={(delta) => resize("profileHeight", delta)}
        />
      )}
      <div
        className="pane-region results-panel"
        style={isCollapsed("results") ? { flex: "none" } : undefined}
      >
        <Section
          title={taskView.resultTitle}
          icon={<FindingsGlyph />}
          isCollapsed={isCollapsed("results")}
          onToggle={() => toggleSection("results")}
          isStretched
          isFlush
        >
          {state.model.tuning.is_minimum_confidence_shown &&
            reviewFilter !== null && (
              <>
                <div
                  className="review-area"
                  style={
                    isCollapsed("review")
                      ? undefined
                      : { height: layout.reviewHeight }
                  }
                >
                  <ReviewPanel
                    classes={state.classes}
                    results={markedResults}
                    reviewFilter={reviewFilter}
                    thresholds={review.thresholds.value ?? state.thresholds}
                    suppression={
                      review.suppression.value ?? state.suppression
                    }
                    labelMode={state.label_mode}
                    standardMinimum={state.standard_minimum}
                    standardOverlap={state.standard_overlap_threshold}
                    isScoreBased={taskView.isScoreBased}
                    isCollapsed={isCollapsed("review")}
                    onToggleCollapsed={() => toggleSection("review")}
                    onThresholdsChange={review.thresholds.change}
                    onSuppressionChange={review.suppression.change}
                    onLabelModeChange={(labelMode) =>
                      call(() => api.setLabelMode(labelMode))
                    }
                  />
                </div>
                {!isCollapsed("review") && (
                  <Splitter
                    isHorizontal
                    onResize={(delta) => resize("reviewHeight", delta)}
                  />
                )}
              </>
            )}
          {isImageResultsShown && (
            <div
              className={`results-area${isCollapsed("image-results") ? " collapsed" : ""}`}
            >
              <ResultTable
                task={task}
                scope="images"
                title="Images"
                emptyText="Open images; their results are listed here as inference completes."
                isCollapsed={isCollapsed("image-results")}
                onToggleCollapsed={() => toggleSection("image-results")}
                rows={resultRows.images.listed}
                allRows={resultRows.images.inScope}
                filter={resultRows.filter}
                onFilterChange={resultRows.setFilter}
                order={resultRows.order}
                onOrderChange={resultRows.setOrder}
                currentPictureKey={resultPictureKey}
                selectedKey={resultRows.selectedRowKey}
                onSelectRow={onSelectRow}
                onSetAccepted={onSetAccepted}
                classColors={classColors}
              />
            </div>
          )}
          {isImageResultsShown &&
            hasVideos &&
            !isCollapsed("image-results") &&
            !isCollapsed("video-results") && (
              <Splitter
                isHorizontal
                onResize={(delta) => resize("videoResultsHeight", delta)}
              />
            )}
          {hasVideos && (
            <div
              className={`results-area${isCollapsed("video-results") ? " collapsed" : ""}`}
              style={
                isImageResultsShown &&
                !isCollapsed("image-results") &&
                !isCollapsed("video-results")
                  ? { flex: `0 1 ${layout.videoResultsHeight}px` }
                  : undefined
              }
            >
              {chartedVideo !== null && (
                <VideoFindingsPanel
                  video={chartedVideo}
                  current={chartedCurrent}
                  results={chartedVideoResults}
                  position={position}
                  isFollowingPlayer={isVideoPlayerUsed}
                  classColors={classColors}
                  isCollapsed={isCollapsed("video-results")}
                  onToggleCollapsed={() => toggleSection("video-results")}
                  onSeek={onSeekChartedVideo}
                />
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
