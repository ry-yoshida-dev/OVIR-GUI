import type {
  CurrentPicture,
  FramePayload,
  TimelinePayload,
  WorkspaceState,
} from "../api/types";
import type { PicturePromptEditor } from "../hooks/usePicturePromptEditor";
import type { DisplayOptions } from "../lib/displayOptions";
import type { FrameResultIndex } from "../lib/frameResultIndex";
import type { ClassColors } from "../lib/frameView";
import type { TableRow } from "../lib/resultTable";
import type { TaskView } from "../lib/taskViews";
import { type CenterMode, CenterModeToggle } from "./CenterModeToggle";
import { ClassificationGallery } from "./ClassificationGallery";
import { SlidersGlyph } from "./Glyphs";
import { PaneHeader } from "./PaneHeader";
import { PopoverButton } from "./PopoverButton";
import { PromptToolbar } from "./PromptToolbar";
import { ResultViewer } from "./ResultViewer";
import { VideoControls } from "./VideoControls";
import type {
  HighlightedFinding,
  VideoPlayback,
} from "./VideoResultPlayer";
import { ViewSettings } from "./ViewSettings";

interface CanvasPaneProps {
  state: WorkspaceState;
  taskView: TaskView;
  centerMode: CenterMode;
  display: DisplayOptions;
  current: CurrentPicture | null;
  currentMediaIndex: number;
  mediaCount: number;
  rows: TableRow[];
  selectedRowKey: string | null;
  highlighted: HighlightedFinding | null;
  listed: Map<string, Set<number>> | null;
  resultPictureKey: string | null;
  classColors: ClassColors;
  promptEditor: PicturePromptEditor;
  frame: FramePayload | null;
  videoResults: FrameResultIndex | null;
  timeline: TimelinePayload | null;
  playback: VideoPlayback;
  isVideoPlayerUsed: boolean;
  onCenterModeChange: (mode: CenterMode) => void;
  onDisplayChange: (display: DisplayOptions) => void;
  onNavigate: (step: number) => void;
  onSelectRow: (row: TableRow) => void;
  onSetAccepted: (rows: TableRow[], isAccepted: boolean) => void;
  onOpenPicture: (path: string, frame: number | null) => void;
  onSelectFinding: (resultFrame: number | null, index: number) => void;
  onClearSelection: () => void;
  onStepFrame: (step: number) => void;
  onVideoPlayerFailed: (error: Error) => void;
  onUploadRequested: () => void;
  onBrowseRequested: () => void;
}

/**
 * Center pane showing either the gallery of every picture or the current picture with its findings.
 */
export function CanvasPane({
  state,
  taskView,
  centerMode,
  display,
  current,
  currentMediaIndex,
  mediaCount,
  rows,
  selectedRowKey,
  highlighted,
  listed,
  resultPictureKey,
  classColors,
  promptEditor,
  frame,
  videoResults,
  timeline,
  playback,
  isVideoPlayerUsed,
  onCenterModeChange,
  onDisplayChange,
  onNavigate,
  onSelectRow,
  onSetAccepted,
  onOpenPicture,
  onSelectFinding,
  onClearSelection,
  onStepFrame,
  onVideoPlayerFailed,
  onUploadRequested,
  onBrowseRequested,
}: CanvasPaneProps) {
  const isGalleryShown =
    taskView.isGalleryAvailable && centerMode === "gallery";
  return (
    <div className="pane pane-canvas">
      <PaneHeader
        title={
          isGalleryShown ? "All pictures" : (current?.name ?? "No picture")
        }
        leading={
          taskView.isGalleryAvailable ? (
            <CenterModeToggle mode={centerMode} onChange={onCenterModeChange} />
          ) : undefined
        }
        navigation={
          isGalleryShown || current === null
            ? undefined
            : {
                isFirst: currentMediaIndex <= 0,
                isLast:
                  currentMediaIndex < 0 ||
                  currentMediaIndex >= mediaCount - 1,
                onNavigate,
              }
        }
      >
        <PopoverButton
          className="sheet-button"
          label="View settings"
          title="How findings are drawn on the pictures"
          trigger={
            <>
              <SlidersGlyph />
              View
            </>
          }
        >
          <ViewSettings
            taskView={taskView}
            display={display}
            isComparisonAvailable={state.compared_profile_key !== null}
            onChange={onDisplayChange}
          />
        </PopoverButton>
      </PaneHeader>
      <div className="center">
        {isGalleryShown ? (
          <ClassificationGallery
            rows={rows}
            media={state.media}
            currentPictureKey={resultPictureKey}
            selectedKey={selectedRowKey}
            classColors={classColors}
            onSelectRow={onSelectRow}
            onSetAccepted={onSetAccepted}
            onOpenPicture={onOpenPicture}
          />
        ) : (
          <div className="center-stage">
            <PromptToolbar
              editor={promptEditor}
              classes={state.classes}
              frameStep={state.sampling.frame_step}
            />
            <ResultViewer
              current={current}
              frame={frame}
              videoResults={videoResults}
              listed={listed}
              highlighted={highlighted}
              options={display}
              classColors={classColors}
              playback={playback}
              isMediaEmpty={state.media.length === 0}
              isVideoPlayerUsed={isVideoPlayerUsed}
              drawing={promptEditor.drawing}
              onSelectFinding={onSelectFinding}
              onClearSelection={onClearSelection}
              onNavigate={onNavigate}
              onStepFrame={onStepFrame}
              onVideoPlayerFailed={onVideoPlayerFailed}
              onUploadRequested={onUploadRequested}
              onBrowseRequested={onBrowseRequested}
            />
            {current !== null &&
              current.kind === "video" &&
              current.frame !== null && (
                <VideoControls
                  current={current}
                  frame={current.frame}
                  timeline={
                    timeline !== null && timeline.path === current.path
                      ? timeline
                      : null
                  }
                  frameStep={state.sampling.frame_step}
                  isClassification={taskView.task === "classification"}
                  isPlaybackShown={!isVideoPlayerUsed}
                  onSeek={playback.onSeek}
                />
              )}
          </div>
        )}
      </div>
    </div>
  );
}
