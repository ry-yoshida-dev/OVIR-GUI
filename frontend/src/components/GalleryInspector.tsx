import { useClassScores } from "../hooks/useClassScores";
import type { GalleryTile } from "../lib/galleryGroups";
import { clamp } from "../lib/numbers";
import { frameText } from "../lib/resultTable";

interface GalleryInspectorProps {
  tile: GalleryTile | null;
  imageSource: string | null;
  colorOf: (className: string) => string;
  onOpen: (path: string, frame: number | null) => void;
  onSetAccepted: (tile: GalleryTile, isAccepted: boolean) => void;
}

function verdictOf(tile: GalleryTile): { text: string; tone: string } {
  const { finding } = tile;
  if (finding === null) return { text: tile.row.kind === "status" ? tile.row.text : "", tone: "muted" };
  if (!finding.is_accepted) return { text: "Rejected", tone: "danger" };
  if (!finding.is_passing) return { text: "Low confidence", tone: "muted" };
  if (tile.isUncertain) return { text: "Uncertain", tone: "warning" };
  return { text: "Kept", tone: "success" };
}

export function GalleryInspector({ tile, imageSource, colorOf, onOpen, onSetAccepted }: GalleryInspectorProps) {
  const allScores = useClassScores(
    tile?.pictureKey ?? null,
    tile?.row.path ?? null,
    tile?.row.frame ?? null,
    tile?.row.scores ?? null,
  );
  if (tile === null || imageSource === null) {
    return (
      <aside className="gallery-inspector empty">
        <div className="gallery-inspector-hint">Select a picture to see every class score.</div>
      </aside>
    );
  }
  const { row, finding, runnerUp, margin } = tile;
  const scores = allScores ?? tile.scores;
  const classCount = Math.max(row.classCount, scores.length);
  const verdict = verdictOf(tile);
  const frame = frameText(row.frame, row.seconds);
  const leaderName = finding?.class_name ?? scores[0]?.class_name ?? null;
  const isRejected = finding !== null && !finding.is_accepted;
  return (
    <aside className="gallery-inspector">
      <button
        type="button"
        className="gallery-inspector-thumb"
        title="Open in the viewer (Enter)"
        onClick={() => onOpen(row.path, row.frame)}
      >
        <img src={imageSource} alt={row.mediaName} draggable={false} />
      </button>
      <div className="gallery-inspector-file" title={row.path}>
        <span className="gallery-inspector-name">{row.mediaName}</span>
        {frame !== "" && <span className="gallery-inspector-frame">{frame}</span>}
      </div>

      <div className="gallery-inspector-hero">
        {leaderName !== null && (
          <div className="gallery-inspector-class">
            <span className="gallery-dot" style={{ background: colorOf(leaderName) }} />
            <span>{leaderName}</span>
          </div>
        )}
        <div className="gallery-inspector-figures">
          <span className={isRejected ? "gallery-inspector-score struck" : "gallery-inspector-score"}>
            {(finding?.confidence ?? scores[0]?.score ?? 0).toFixed(3)}
          </span>
          {verdict.text !== "" && <span className={`gallery-verdict ${verdict.tone}`}>{verdict.text}</span>}
        </div>
        {runnerUp !== null && margin !== null && (
          <div className="gallery-inspector-lead">
            <span className={tile.isUncertain ? "gallery-lead-value warning" : "gallery-lead-value"}>
              +{margin.toFixed(3)}
            </span>
            <span> lead over {runnerUp.class_name}</span>
          </div>
        )}
      </div>

      {scores.length > 0 && (
        <div className="gallery-ranking">
          <div className="gallery-ranking-header">
            <span>All classes</span>
            <span>{classCount}</span>
          </div>
          <ol className="gallery-ranking-list">
            {scores.map((score, rank) => (
              <li
                key={score.class_name}
                className={rank === 0 ? "gallery-ranking-line leader" : "gallery-ranking-line"}
                title={`${score.class_name}: ${score.score.toFixed(4)}`}
              >
                <span className="gallery-ranking-rank">{rank + 1}</span>
                <span className="gallery-ranking-name">
                  <span className="gallery-dot small" style={{ background: colorOf(score.class_name) }} />
                  {score.class_name}
                </span>
                <span className="gallery-ranking-value">{score.score.toFixed(3)}</span>
                <span className="gallery-ranking-track">
                  <span
                    style={{
                      width: `${clamp(score.score, 0, 1) * 100}%`,
                      background: colorOf(score.class_name),
                    }}
                  />
                </span>
              </li>
            ))}
          </ol>
          {scores.length < classCount && <div className="gallery-ranking-pending">Loading every class…</div>}
        </div>
      )}

      <div className="gallery-inspector-actions">
        <button type="button" onClick={() => onOpen(row.path, row.frame)}>
          Open <kbd>↵</kbd>
        </button>
        {finding !== null && (
          <button type="button" onClick={() => onSetAccepted(tile, !finding.is_accepted)}>
            {finding.is_accepted ? "Reject" : "Keep"} <kbd>Space</kbd>
          </button>
        )}
      </div>
    </aside>
  );
}
