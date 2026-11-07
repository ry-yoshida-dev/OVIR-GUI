import { useRef } from "react";
import type {
  CurrentPicture,
  FramePayload,
  TimelinePayload,
  WorkspaceState,
} from "@/api/types";
import type { ShownPicture } from "@/domain/annotatedSnapshot";
import type { PicturePromptEditor } from "@/features/picture-prompts/usePicturePromptEditor";
import type { DisplayOptions } from "@/domain/displayOptions";
import type { FrameResultIndex } from "@/domain/frameResultIndex";
import type { ClassColors } from "@/domain/frameView";
import type { TableRow } from "@/domain/resultTable";
import type { TaskView } from "@/domain/taskViews";
import { type CenterMode, CenterModeToggle } from "./CenterModeToggle";
import { ClassificationGallery } from "@/features/gallery/ClassificationGallery";
import { CopyPictureButton } from "@/features/canvas/CopyPictureButton";
import { SlidersGlyph } from "@/components/Glyphs";
import { PaneHeader } from "./PaneHeader";
import { PictureGallery } from "@/features/gallery/PictureGallery";
import { PopoverButton } from "@/components/PopoverButton";
import { PromptToolbar } from "@/features/picture-prompts/PromptToolbar";
import { ResultViewer } from "@/features/canvas/ResultViewer";
import { VideoControls } from "@/features/playback/VideoControls";
import type {
  HighlightedFinding,
  VideoPlayback,
} from "@/features/playback/VideoResultPlayer";
import { ViewSettings } from "@/features/canvas/ViewSettings";

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
  const shownPictureRef = useRef<ShownPicture | null>(null);
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
        {!isGalleryShown && (
          <CopyPictureButton
            shownPictureRef={shownPictureRef}
            isDisabled={
              current === null ||
              (current.kind === "video" && isVideoPlayerUsed)
            }
          />
        )}
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
        {isGalleryShown && taskView.task === "classification" ? (
          <ClassificationGallery
            rows={rows}
            options={display}
            media={state.media}
            currentPictureKey={resultPictureKey}
            selectedKey={selectedRowKey}
            classColors={classColors}
            onSelectRow={onSelectRow}
            onSetAccepted={onSetAccepted}
            onOpenPicture={onOpenPicture}
          />
        ) : isGalleryShown ? (
          <PictureGallery
            taskView={taskView}
            rows={rows}
            options={display}
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
              shownPictureRef={shownPictureRef}
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
