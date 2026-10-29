import { useMaskOutlines } from "../hooks/useMaskOutlines";
import type { DisplayOptions } from "../lib/displayOptions";
import { type ClassColors, classColorOf } from "../lib/frameView";
import type { MaskOutlineCache } from "../lib/maskOutlineCache";
import type { PictureTile } from "../lib/pictureGallery";
import { type FindingRow, frameText, type TableRow } from "../lib/resultTable";
import type { TaskView } from "../lib/taskViews";
import { FindingOverlay } from "./FindingOverlay";

interface PictureGalleryInspectorProps {
  taskView: TaskView;
  tile: PictureTile | null;
  selectedFinding: FindingRow | null;
  imageSource: string | null;
  isMaskTask: boolean;
  options: DisplayOptions;
  classColors: ClassColors;
  outlineCache: MaskOutlineCache;
  onSelectRow: (row: TableRow) => void;
  onOpen: (path: string, frame: number | null) => void;
  onSetAccepted: (row: FindingRow, isAccepted: boolean) => void;
}

const NO_ROWS: FindingRow[] = [];

function lineClassOf(row: FindingRow, isSelected: boolean): string {
  return [
    "picture-finding",
    isSelected ? "selected" : "",
    row.finding.is_accepted ? "" : "rejected",
    row.finding.is_passing ? "" : "below-minimum",
  ]
    .filter((name) => name !== "")
    .join(" ");
}

/**
 * Side panel of the picture gallery: the selected picture with every finding on it, each kept or rejected there.
 */
export function PictureGalleryInspector({
  taskView,
  tile,
  selectedFinding,
  imageSource,
  isMaskTask,
  options,
  classColors,
  outlineCache,
  onSelectRow,
  onOpen,
  onSetAccepted,
}: PictureGalleryInspectorProps) {
  const pictureRows = tile?.pictureRows ?? NO_ROWS;
  const outlines = useMaskOutlines(outlineCache, pictureRows, isMaskTask && options.isMaskShown);
  if (tile === null || imageSource === null) {
    return (
      <aside className="gallery-inspector empty">
        <div className="gallery-inspector-hint">Select a picture to see its {taskView.findingNoun}.</div>
      </aside>
    );
  }
  const { leadRow } = tile;
  const frame = frameText(leadRow.frame, leadRow.seconds);
  const listed = [...pictureRows].sort((left, right) => right.finding.confidence - left.finding.confidence);
  return (
    <aside className="gallery-inspector">
      <button
        type="button"
        className="gallery-inspector-thumb picture-inspector-thumb"
        title="Open in the viewer (Enter)"
        onClick={() => onOpen(leadRow.path, leadRow.frame)}
      >
        <img src={imageSource} alt={leadRow.mediaName} draggable={false} />
        <FindingOverlay
          width={leadRow.pictureWidth}
          height={leadRow.pictureHeight}
          rows={pictureRows}
          outlines={outlines}
          isMaskTask={isMaskTask}
          options={options}
          classColors={classColors}
          highlightedKey={selectedFinding?.key ?? null}
          fit="contain"
        />
      </button>
      <div className="gallery-inspector-file" title={leadRow.path}>
        <span className="gallery-inspector-name">{leadRow.mediaName}</span>
        {frame !== "" && <span className="gallery-inspector-frame">{frame}</span>}
      </div>

      <div className="gallery-ranking">
        <div className="gallery-ranking-header">
          <span>{taskView.resultTitle}</span>
          <span>{listed.length}</span>
        </div>
        {listed.length === 0 ? (
          <div className="gallery-inspector-hint">{leadRow.kind === "status" ? leadRow.text : taskView.emptyPictureText}</div>
        ) : (
          <ul className="picture-finding-list">
            {listed.map((row) => (
              <li
                key={row.key}
                className={lineClassOf(row, row.key === selectedFinding?.key)}
                title={`${row.finding.class_name}: ${row.finding.confidence.toFixed(4)}`}
                onClick={() => onSelectRow(row)}
              >
                <span className="gallery-dot small" style={{ background: classColorOf(classColors, row.finding.class_name) }} />
                <span className="picture-finding-name">{row.finding.class_name}</span>
                <span className="picture-finding-value">{row.finding.confidence.toFixed(3)}</span>
                <button
                  type="button"
                  className="picture-finding-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSetAccepted(row, !row.finding.is_accepted);
                  }}
                >
                  {row.finding.is_accepted ? "Reject" : "Keep"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="gallery-inspector-actions">
        <button type="button" onClick={() => onOpen(leadRow.path, leadRow.frame)}>
          Open <kbd>↵</kbd>
        </button>
        {selectedFinding !== null && (
          <button type="button" onClick={() => onSetAccepted(selectedFinding, !selectedFinding.finding.is_accepted)}>
            {selectedFinding.finding.is_accepted ? "Reject" : "Keep"} <kbd>Space</kbd>
          </button>
        )}
      </div>
    </aside>
  );
}
