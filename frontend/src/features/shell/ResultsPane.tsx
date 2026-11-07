import { api } from "@/api/client";
import type {
  CurrentPicture,
  MediaEntry,
  MediaKindValue,
  ResultsPayload,
  TaskValue,
  WorkspaceState,
} from "@/api/types";
import type { Call, RunAction } from "@/behaviors/useActionRunner";
import type { LayoutState } from "@/state/useLayoutState";
import type { ResultRows } from "@/state/useResultRows";
import type { ReviewDraft } from "@/features/review/useReviewDraft";
import type { FrameResultIndex } from "@/domain/frameResultIndex";
import type { ClassColors } from "@/domain/frameView";
import type { PlaybackPosition } from "@/domain/playbackPosition";
import type { TableRow } from "@/domain/resultTable";
import type { TaskView } from "@/domain/taskViews";
import { FindingsGlyph, StatisticsGlyph } from "@/components/Glyphs";
import { PaneHeader } from "./PaneHeader";
import { ProfileTable } from "@/features/findings/ProfileTable";
import { ResultTable } from "@/features/findings/ResultTable";
import { ReviewPanel } from "@/features/review/ReviewPanel";
import { Section } from "@/components/Section";
import { Splitter } from "@/components/Splitter";
import { VideoFindingsPanel } from "@/features/playback/VideoFindingsPanel";

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
  onOpenExport: (media: MediaKindValue) => void;
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
                    standardMinimum={state.standard_minimum}
                    standardOverlap={state.standard_overlap_threshold}
                    isScoreBased={taskView.isScoreBased}
                    isCollapsed={isCollapsed("review")}
                    onToggleCollapsed={() => toggleSection("review")}
                    onThresholdsChange={review.thresholds.change}
                    onSuppressionChange={review.suppression.change}
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
                exportCount={resultRows.imageExportRows.length}
                isExportDisabled={state.is_busy}
                onExport={() => onOpenExport("image")}
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
                  exportCount={resultRows.videoExportRows.length}
                  isExportDisabled={state.is_busy}
                  onExport={() => onOpenExport("video")}
                />
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
