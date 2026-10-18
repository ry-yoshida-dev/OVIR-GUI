import { api } from "../api/client";
import type { CurrentPicture, FrameInstance, FramePayload } from "../api/types";
import { usePreloadedSource } from "../hooks/usePreloadedSource";
import type { DisplayOptions } from "../lib/displayOptions";
import type { FrameResultIndex } from "../lib/frameResultIndex";
import { comparedOf, FALLBACK_CLASS_COLOR, labelOf, visibleInstancesOf } from "../lib/frameView";
import { BoxShape } from "./BoxShape";
import { MaskShape } from "./MaskShape";
import { ScorePanel } from "./ScorePanel";
import { type HighlightedFinding, VideoResultPlayer } from "./VideoResultPlayer";
import { ZoomableImage } from "./ZoomableImage";

interface ResultViewerProps {
  current: CurrentPicture | null;
  frame: FramePayload | null;
  videoResults: FrameResultIndex | null;
  listed: Map<string, Set<number>> | null;
  listedIndices: Set<number> | null;
  highlighted: HighlightedFinding | null;
  highlightedIndex: number | null;
  options: DisplayOptions;
  classColors: Record<string, string>;
  isMediaEmpty: boolean;
  isVideoPlayerUsed: boolean;
  onSelectFinding: (resultFrame: number | null, index: number) => void;
  onClearSelection: () => void;
  onNavigate: (step: number) => void;
  onSeek: (frame: number, isFinal: boolean) => void;
  onStepFrame: (step: number) => void;
  onVideoPlayerFailed: (error: Error) => void;
  onUploadRequested: () => void;
  onBrowseRequested: () => void;
}

function sourceOf(current: CurrentPicture | null, isVideoPlayerUsed: boolean): string | null {
  if (current === null) return null;
  if (current.kind === "video") {
    return isVideoPlayerUsed || current.frame === null ? null : api.frameUrl(current.path, current.frame, current.version);
  }
  return api.imageUrl(current.path, current.version);
}

export function ResultViewer({
  current,
  frame,
  videoResults,
  listed,
  listedIndices,
  highlighted,
  highlightedIndex,
  options,
  classColors,
  isMediaEmpty,
  isVideoPlayerUsed,
  onSelectFinding,
  onClearSelection,
  onNavigate,
  onSeek,
  onStepFrame,
  onVideoPlayerFailed,
  onUploadRequested,
  onBrowseRequested,
}: ResultViewerProps) {
  const isPlayerShown = isVideoPlayerUsed && current !== null && current.kind === "video" && current.width !== null;
  const source = usePreloadedSource(sourceOf(current, isVideoPlayerUsed));
  if (isPlayerShown) {
    return (
      <VideoResultPlayer
        current={current}
        frame={frame !== null && frame.path === current.path ? frame : null}
        results={videoResults}
        listed={listed}
        highlighted={highlighted}
        options={options}
        classColors={classColors}
        onSeek={onSeek}
        onSelectFinding={onSelectFinding}
        onNavigate={onNavigate}
        onError={onVideoPlayerFailed}
      />
    );
  }
  if (current === null || current.width === null || current.height === null || source === null) {
    return (
      <div className="empty-center">
        {isMediaEmpty ? (
          <div className="drop-zone">
            <div className="headline">Drop images, videos or folders here</div>
            <div className="small" style={{ color: "#aab0b8" }}>
              Dropped files are uploaded to the server. Files already on the server can be opened by path.
            </div>
            <div className="row">
              <button onClick={onUploadRequested}>Upload Files…</button>
              <button onClick={onBrowseRequested}>Open from Server…</button>
            </div>
          </div>
        ) : current === null ? (
          <span>Select an image or a video.</span>
        ) : (
          <span>Cannot read {current.name}.</span>
        )}
      </div>
    );
  }
  const isFrameOfCurrent = frame !== null && frame.path === current.path;
  const visible: FrameInstance[] = isFrameOfCurrent ? visibleInstancesOf(frame, listedIndices, options) : [];
  const compared = isFrameOfCurrent ? comparedOf(frame, options) : null;
  const comparedPrefix = compared === null ? "" : `${compared.model_name}: `;
  const scores = isFrameOfCurrent ? frame.scores : [];
  const colorOf = (className: string) => classColors[className] ?? FALLBACK_CLASS_COLOR;
  const selectFinding = (index: number) => {
    if (isFrameOfCurrent) onSelectFinding(frame.result_frame, index);
  };
  const resultNote = !isFrameOfCurrent
    ? ""
    : !frame.is_recognized
      ? " · not recognized"
      : frame.is_exact || frame.result_frame === null
        ? ""
        : ` · result of #${frame.result_frame}`;
  const frameNote =
    current.kind === "video" && current.frame !== null
      ? ` · #${current.frame}/${(current.frame_count ?? 1) - 1}${current.timestamp === null ? "" : ` (${current.timestamp})`}`
      : "";
  const countNote = scores.length > 0 ? "" : ` · ${visible.length} ${frame?.task === "segmentation" ? "instances" : "boxes"}`;

  const renderInstance = (finding: FrameInstance, isHighlighted: boolean, scale: number) => {
    const color = colorOf(finding.class_name);
    const isRejected = !finding.is_accepted;
    const hasMask = finding.polygons.length > 0;
    return (
      <g key={finding.index}>
        {hasMask && options.isMaskShown && (
          <MaskShape
            polygons={finding.polygons}
            color={color}
            opacity={options.maskOpacity}
            isRejected={isRejected}
            isHighlighted={isHighlighted}
            lineWidth={Math.max(1, options.lineWidth - 1)}
            onClick={() => selectFinding(finding.index)}
          />
        )}
        <BoxShape
          box={finding.box}
          color={color}
          role={isRejected ? "rejected" : "kept"}
          scale={scale}
          lineWidth={options.lineWidth}
          isFilled={options.isFilled && !hasMask}
          isHighlighted={isHighlighted && (!hasMask || !options.isMaskShown)}
          isBoxHidden={hasMask && options.isMaskShown && !options.isMaskBoxShown && !isHighlighted}
          label={labelOf(finding, options)}
          onClick={() => selectFinding(finding.index)}
        />
      </g>
    );
  };

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
      <ZoomableImage
        src={source}
        fitKey={current.path}
        width={current.width}
        height={current.height}
        onBackgroundClick={onClearSelection}
        onKeyDown={(event) => {
          const isVideo = current.kind === "video";
          if (event.key === "PageUp" || (!isVideo && event.key === "ArrowLeft")) {
            event.preventDefault();
            onNavigate(-1);
          } else if (event.key === "PageDown" || (!isVideo && event.key === "ArrowRight")) {
            event.preventDefault();
            onNavigate(1);
          } else if (isVideo && event.key === "ArrowLeft") {
            event.preventDefault();
            onStepFrame(event.shiftKey ? -10 : -1);
          } else if (isVideo && event.key === "ArrowRight") {
            event.preventDefault();
            onStepFrame(event.shiftKey ? 10 : 1);
          }
        }}
        hud={
          <span>
            {" · "}
            {current.name} ({current.width}×{current.height}){frameNote}
            {countNote}
            {resultNote}
            {isFrameOfCurrent && frame.outdated !== null && (
              <span style={{ color: "var(--warning)" }} title={`Recognized with other classes: ${frame.outdated}`}>
                {" "}
                ⚠ outdated
              </span>
            )}
          </span>
        }
      >
        {(scale) => (
          <>
            {compared?.findings.map((finding) => (
              <g key={`compared-${finding.index}`}>
                {finding.polygons.length > 0 && options.isMaskShown && (
                  <MaskShape
                    polygons={finding.polygons}
                    color={colorOf(finding.class_name)}
                    opacity={0}
                    isRejected={false}
                    isOutlineOnly
                    lineWidth={options.lineWidth}
                  />
                )}
                <BoxShape
                  box={finding.box}
                  color={colorOf(finding.class_name)}
                  role="compared"
                  scale={scale}
                  lineWidth={options.lineWidth}
                  isFilled={false}
                  label={labelOf(finding, options, comparedPrefix)}
                />
              </g>
            ))}
            {visible
              .filter((finding) => finding.index !== highlightedIndex)
              .map((finding) => renderInstance(finding, false, scale))}
            {visible
              .filter((finding) => finding.index === highlightedIndex)
              .map((finding) => renderInstance(finding, true, scale))}
          </>
        )}
      </ZoomableImage>
      {isFrameOfCurrent && (
        <ScorePanel
          frame={frame}
          listedIndices={listedIndices}
          options={options}
          classColors={classColors}
          onSelectFinding={selectFinding}
        />
      )}
    </div>
  );
}
