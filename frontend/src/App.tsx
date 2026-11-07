import { useCallback, useMemo, useState } from "react";
import { api } from "@/api/client";
import type { TaskValue } from "@/api/types";
import { type AppDialog, AppDialogs } from "@/features/shell/AppDialogs";
import { BinderShape } from "@/features/shell/BinderShape";
import { BinderTabs } from "@/features/shell/BinderTabs";
import { CanvasPane } from "@/features/shell/CanvasPane";
import type { CenterMode } from "@/features/shell/CenterModeToggle";
import { ConnectionIndicator } from "@/features/shell/ConnectionIndicator";
import { DropOverlay } from "@/features/shell/DropOverlay";
import { useMenu } from "@/components/Menu";
import { Notices } from "@/features/shell/Notices";
import { ResultsPane } from "@/features/shell/ResultsPane";
import { SetupPane } from "@/features/shell/SetupPane";
import { Splitter } from "@/components/Splitter";
import { StatisticsDialog } from "@/features/statistics/StatisticsDialog";
import { StatusBar } from "@/features/shell/StatusBar";
import type { VideoPlayback } from "@/features/playback/VideoResultPlayer";
import { useActionRunner } from "@/behaviors/useActionRunner";
import { useEmbedding } from "@/features/embedding/useEmbedding";
import { useGlobalShortcuts } from "@/features/shell/useGlobalShortcuts";
import { useInfer } from "@/features/inference/useInfer";
import { useLayoutState } from "@/state/useLayoutState";
import { useMediaNavigation } from "@/features/media/useMediaNavigation";
import { useMediaUpload } from "@/features/media/useMediaUpload";
import { useModelSelection } from "@/features/models/useModelSelection";
import { usePicturePromptEditor } from "@/features/picture-prompts/usePicturePromptEditor";
import { usePlaybackSync } from "@/features/playback/usePlaybackSync";
import { useResultRows } from "@/state/useResultRows";
import { useReviewDraft } from "@/features/review/useReviewDraft";
import { useShownResults } from "@/state/useShownResults";
import { useStatusMessage } from "@/state/useStatusMessage";
import { useStoredState } from "@/behaviors/useStoredState";
import { useTaskDisplayOptions } from "@/state/useTaskDisplayOptions";
import { useVideoPlayerFallback } from "@/features/playback/useVideoPlayerFallback";
import { useWorkspace } from "@/state/useWorkspace";
import {
  groupFindings,
  rowKeyOf,
  type TableRow,
} from "@/domain/resultTable";
import { TASK_ORDER, taskViewOf } from "@/domain/taskViews";

interface CenterLayout {
  mode: CenterMode;
}

const DEFAULT_CENTER_LAYOUT: CenterLayout = { mode: "gallery" };
const NO_SUFFIXES: string[] = [];

export function App() {
  const workspace = useWorkspace();
  const { state, results, resultsVersion } = workspace;
  const menu = useMenu();
  const layoutState = useLayoutState();
  const { layout, resize } = layoutState;
  const [centerLayout, setCenterLayout] = useStoredState<CenterLayout>(
    "ovir-gui.center",
    DEFAULT_CENTER_LAYOUT,
  );
  const [openDialog, setOpenDialog] = useState<AppDialog | null>(null);
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);

  const statusMessage = useStatusMessage(state?.status.serial ?? null);
  const { report } = statusMessage;
  const { call, runAction } = useActionRunner(report);
  const upload = useMediaUpload(report, state?.accepted_suffixes ?? NO_SUFFIXES);
  const promptEditor = usePicturePromptEditor({ state, call, report });
  const modelSelector = useModelSelection(state, call, report);
  const review = useReviewDraft(state, call);

  const frameStep = state?.sampling.frame_step ?? 1;
  const playbackSync = usePlaybackSync({
    serverCurrent: state?.current ?? null,
    frameStep,
    isRecognitionRunning: state?.is_busy ?? false,
    isAutoInferenceRunning:
      (state?.inference.is_auto ?? false) &&
      state?.inference.pause_reason === null,
    call,
  });
  const { current, position, live, show, seek, follow, startLive } =
    playbackSync;
  const currentPath = current?.path ?? null;
  const shown = useShownResults({
    state,
    results,
    resultsVersion,
    current,
    isLiveRunning: playbackSync.isLiveRunning,
    position,
    draftFilter: review.draftFilter,
  });
  const { chartedVideo, isChartedVideoCurrent, resultPictureKey } = shown;

  const task: TaskValue = state?.task.value ?? "detection";
  const [display, setDisplay] = useTaskDisplayOptions(task);
  const hasImages =
    state?.media.some((entry) => entry.kind === "image") ?? false;
  const hasVideos =
    state?.media.some((entry) => entry.kind === "video") ?? false;
  const isImageResultsShown = hasImages || !hasVideos;
  const resultRows = useResultRows({
    results: shown.markedResults,
    belowMinimum: display.belowMinimum,
    task,
  });
  const { selectedRow, setSelectedRowKey } = resultRows;
  const classColors = useMemo(
    () =>
      Object.fromEntries(
        (state?.classes ?? []).map((entry) => [entry.name, entry.color]),
      ),
    [state?.classes],
  );
  const playback: VideoPlayback = useMemo(
    () => ({ position, live, onSeek: seek, onFollow: follow }),
    [position, live, seek, follow],
  );
  const videoPlayer = useVideoPlayerFallback(
    current,
    promptEditor.drawing !== null,
    call,
    report,
  );

  const clearSelection = useCallback(
    () => setSelectedRowKey(null),
    [setSelectedRowKey],
  );
  const { orderedMedia, currentMediaIndex, showMedia, navigate } =
    useMediaNavigation(state?.media, currentPath, show, clearSelection);

  const isBusy = state?.is_busy ?? true;
  const selectTask = useCallback(
    (nextTask: TaskValue) => {
      if (isBusy || nextTask === task) return;
      setSelectedRowKey(null);
      void call(() => api.selectTask(nextTask));
    },
    [isBusy, task, setSelectedRowKey, call],
  );

  const infer = useInfer({
    mode: state?.inference.mode ?? "shown",
    current,
    position,
    runAction,
    onLiveStarted: startLive,
  });

  useEmbedding(state?.current?.path ?? null, state?.current?.frame ?? null);
  useGlobalShortcuts({
    onSelectTask: selectTask,
    onExport: () =>
      setOpenDialog({
        kind: "export",
        media: isImageResultsShown ? "image" : "video",
      }),
    onToggleStatistics: () => setIsStatisticsOpen((isOpen) => !isOpen),
    onBrowse: () => setOpenDialog({ kind: "browse" }),
  });

  if (state === null) {
    return (
      <div className="empty-center connecting">
        {workspace.connection === "closed"
          ? "Cannot reach the OVIR GUI server; retrying…"
          : "Connecting…"}
      </div>
    );
  }

  const taskView = taskViewOf(task);
  const selectRow = (row: TableRow) => {
    setSelectedRowKey(row.key);
    if (
      row.path !== currentPath ||
      (row.frame !== null && row.frame !== (current?.frame ?? null))
    )
      show(row.path, row.frame);
  };
  const openPicture = (path: string, frame: number | null) => {
    setCenterLayout({ mode: "image" });
    show(path, frame);
  };
  const setAccepted = (targets: TableRow[], isAccepted: boolean) => {
    void call(() => api.setAccepted(groupFindings(targets), isAccepted));
  };

  return (
    <div className="app">
      <div className="binder" data-task={task}>
        <BinderShape task={task} tasks={TASK_ORDER} />
        <div className="binder-band">
          <BinderTabs
            task={task}
            tasks={TASK_ORDER}
            isDisabled={state.is_busy}
            onSelect={selectTask}
          />
          <div className="binder-controls">
            <ConnectionIndicator connection={workspace.connection} />
          </div>
        </div>

        <div
          className="binder-sheet"
          role="tabpanel"
          aria-label={taskView.label}
        >
          <div className="sheet-main">
            <SetupPane
              state={state}
              task={task}
              width={layout.sidebarWidth}
              orderedMedia={orderedMedia}
              currentPath={currentPath}
              modelSelector={modelSelector}
              call={call}
              isCollapsed={layoutState.isCollapsed}
              onToggleSection={layoutState.toggleSection}
              onReport={report}
              onOpenDialog={setOpenDialog}
              onOpenMenu={menu.openBelow}
              onUploadFiles={upload.chooseFiles}
              onUploadFolder={upload.chooseFolder}
              onShowMedia={showMedia}
              onInfer={infer}
            />
            <Splitter onResize={(delta) => resize("sidebarWidth", delta)} />
            <CanvasPane
              state={state}
              taskView={taskView}
              centerMode={centerLayout.mode}
              display={display}
              current={current}
              currentMediaIndex={currentMediaIndex}
              mediaCount={orderedMedia.length}
              rows={resultRows.rows}
              selectedRowKey={resultRows.selectedRowKey}
              highlighted={
                selectedRow?.kind === "finding" &&
                selectedRow.path === currentPath
                  ? {
                      frame: selectedRow.frame,
                      index: selectedRow.finding.index,
                    }
                  : null
              }
              listed={resultRows.isFiltered ? resultRows.listed : null}
              resultPictureKey={resultPictureKey}
              classColors={classColors}
              promptEditor={promptEditor}
              frame={shown.markedFramePayload}
              videoResults={
                isChartedVideoCurrent ? shown.chartedVideoResults : null
              }
              timeline={shown.timeline}
              playback={playback}
              isVideoPlayerUsed={videoPlayer.isVideoPlayerUsed}
              onCenterModeChange={(mode) => setCenterLayout({ mode })}
              onDisplayChange={setDisplay}
              onNavigate={navigate}
              onSelectRow={selectRow}
              onSetAccepted={setAccepted}
              onOpenPicture={openPicture}
              onSelectFinding={(resultFrame, index) => {
                if (currentPath !== null)
                  setSelectedRowKey(rowKeyOf(currentPath, resultFrame, index));
              }}
              onClearSelection={clearSelection}
              onStepFrame={playbackSync.stepFrame}
              onVideoPlayerFailed={videoPlayer.onVideoPlayerFailed}
              onUploadRequested={upload.chooseFiles}
              onBrowseRequested={() => setOpenDialog({ kind: "browse" })}
            />
            <Splitter onResize={(delta) => resize("rightWidth", delta)} />
            <ResultsPane
              state={state}
              task={task}
              taskView={taskView}
              layoutState={layoutState}
              review={review}
              markedResults={shown.markedResults}
              resultRows={resultRows}
              isImageResultsShown={isImageResultsShown}
              hasVideos={hasVideos}
              resultPictureKey={resultPictureKey}
              classColors={classColors}
              chartedVideo={chartedVideo}
              chartedCurrent={isChartedVideoCurrent ? current : null}
              chartedVideoResults={shown.chartedVideoResults}
              position={position}
              isVideoPlayerUsed={videoPlayer.isVideoPlayerUsed}
              call={call}
              runAction={runAction}
              onToggleStatistics={() =>
                setIsStatisticsOpen((isOpen) => !isOpen)
              }
              onOpenExport={(media) => setOpenDialog({ kind: "export", media })}
              onSelectRow={selectRow}
              onSetAccepted={setAccepted}
              onSeekChartedVideo={
                isChartedVideoCurrent || chartedVideo === null
                  ? seek
                  : (frame) => show(chartedVideo.path, frame)
              }
            />
          </div>
        </div>
      </div>

      <StatusBar
        state={state}
        localMessage={statusMessage.text}
        upload={upload.progress}
        onCancel={() => void call(api.cancel)}
      />

      <Notices
        notices={workspace.notices}
        onDismiss={workspace.dismissNotice}
      />

      {upload.isDragOver && (
        <DropOverlay uploadDirectory={state.upload_directory} />
      )}

      {isStatisticsOpen && (
        <StatisticsDialog
          refreshToken={`${state.status.serial}:${state.shown_profile_key}:${state.compared_profile_key}:${JSON.stringify(state.thresholds)}:${resultsVersion}`}
          thresholds={review.thresholds.value ?? state.thresholds}
          classColors={classColors}
          profiles={state.profiles}
          shownKey={state.shown_profile_key}
          comparedKey={state.compared_profile_key}
          onThresholdsChange={review.thresholds.change}
          onCompare={(key) => void call(() => api.compare(key))}
          onOpenPicture={openPicture}
          onClose={() => setIsStatisticsOpen(false)}
        />
      )}

      <AppDialogs
        dialog={openDialog}
        state={state}
        classSetsVersion={workspace.classSetsVersion}
        imageExportRows={resultRows.imageExportRows}
        imageListedRows={resultRows.images.listed}
        videoExportRows={resultRows.videoExportRows}
        isLabelConfidenceShown={display.isConfidenceShown}
        call={call}
        runAction={runAction}
        onReport={report}
        onClose={() => setOpenDialog(null)}
      />

      {upload.pickers}
      {menu.element}
    </div>
  );
}
