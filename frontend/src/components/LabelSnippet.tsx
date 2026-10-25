import { useEffect, useState } from "react";
import type { LabelPreview } from "../api/types";
import { Dialog } from "./Dialog";
import { AnnotationsGlyph, ExpandGlyph } from "./Glyphs";

interface LabelSnippetProps {
  preview: LabelPreview | null;
}

const COPIED_MILLISECONDS = 1500;

/**
 * Snippet of the label file the chosen export writes, named by its file, copyable and openable in a larger view.
 */
export function LabelSnippet({ preview }: LabelSnippetProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  useEffect(() => {
    if (!isCopied) return;
    const timer = window.setTimeout(() => setIsCopied(false), COPIED_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [isCopied]);

  const isEmpty = preview === null || preview.text === "";
  const title = preview === null || preview.file_name === "" ? "Written files" : preview.file_name;
  const notes = [
    ...(preview?.is_shown_picture_only ? ["shown picture"] : []),
    ...(preview?.is_truncated ? ["beginning only"] : []),
  ];
  const copyButton = (
    <button
      className="ghost small"
      disabled={isEmpty}
      onClick={() => void navigator.clipboard.writeText(preview?.text ?? "").then(() => setIsCopied(true))}
      title="Copy the label text"
    >
      {isCopied ? "Copied" : "Copy"}
    </button>
  );

  return (
    <>
      <div className="label-snippet">
        <div className="label-snippet-header">
          <AnnotationsGlyph />
          <span className="label-snippet-title" title={title}>
            {preview === null ? "Label" : title}
          </span>
          {notes.length > 0 && <span className="muted">· {notes.join(" · ")}</span>}
          <span className="grow" />
          {copyButton}
          <button
            className="ghost icon"
            disabled={isEmpty}
            onClick={() => setIsExpanded(true)}
            title="Show the label in a larger view"
            aria-label="Expand the label"
          >
            <ExpandGlyph />
          </button>
        </div>
        {preview === null ? (
          <div className="label-snippet-body label-snippet-note">Creating the label for the current selection…</div>
        ) : isEmpty ? (
          <div className="label-snippet-body label-snippet-note">No recognized pictures to export.</div>
        ) : (
          <pre className="label-snippet-body">{preview.text}</pre>
        )}
      </div>
      {isExpanded && preview !== null && (
        <Dialog
          title={<span className="label-snippet-title">{title}</span>}
          onClose={() => setIsExpanded(false)}
          width={760}
          footer={
            <>
              {notes.length > 0 && <span className="muted small left">{notes.join(" · ")}</span>}
              {copyButton}
              <button onClick={() => setIsExpanded(false)}>Close</button>
            </>
          }
        >
          <pre className="label-snippet label-snippet-expanded">{preview.text}</pre>
        </Dialog>
      )}
    </>
  );
}
