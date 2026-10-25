import type { MediaEntry } from "../api/types";

interface MediaStatusNoteProps {
  entry: MediaEntry;
  isInferring: boolean;
}

/**
 * Words after a media file's name saying what its recognition found or why it has no current result.
 */
export function MediaStatusNote({ entry, isInferring }: MediaStatusNoteProps) {
  if (isInferring) return <span className="media-status-note faint">inferring…</span>;
  switch (entry.state) {
    case "not_analyzed":
      return null;
    case "done":
      return entry.kept_count === 0 ? (
        <span className="media-status-note faint">none found</span>
      ) : (
        <span className="media-status-note muted">{entry.kept_count} found</span>
      );
    case "partial":
      return (
        <span className="media-status-note muted">
          {entry.recognized_count}/{entry.expected_count} frames inferred
        </span>
      );
    case "outdated":
      return <span className="media-status-note outdated">classes changed</span>;
    case "failed":
      return <span className="media-status-note failed">failed</span>;
  }
}
