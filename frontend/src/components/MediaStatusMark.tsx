import type { MediaEntry } from "../api/types";

interface MediaStatusMarkProps {
  entry: MediaEntry;
  isInferring: boolean;
}

/**
 * Mark before a media file's name: a check once every picture is inferred, a warning for outdated or failed results, nothing otherwise.
 */
export function MediaStatusMark({ entry, isInferring }: MediaStatusMarkProps) {
  if (isInferring)
    return (
      <svg className="media-status-mark inferring" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="var(--border-strong)" strokeWidth="2" />
        <path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5" fill="none" stroke="var(--progress)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  switch (entry.state) {
    case "not_analyzed":
    case "partial":
      return <span className="media-status-mark" />;
    case "done":
      return (
        <svg className="media-status-mark" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "outdated":
      return (
        <svg className="media-status-mark" viewBox="0 0 16 16" aria-hidden="true">
          <g fill="none" stroke="var(--warning)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2" />
            <path d="M11.8 2.2v3h-3" />
          </g>
        </svg>
      );
    case "failed":
      return (
        <svg className="media-status-mark" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" fill="var(--danger)" />
          <path d="M8 4.5v4.2" stroke="var(--panel)" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="8" cy="11.3" r="1" fill="var(--panel)" />
        </svg>
      );
  }
}
