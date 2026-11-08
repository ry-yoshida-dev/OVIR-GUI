import type { DrawingTool } from "./usePicturePromptEditor";

interface DrawingHintProps {
  readonly tool: DrawingTool;
  readonly activeObjectId: number | null;
  readonly isPointSupported: boolean;
  readonly isSequential: boolean;
}

function PinMark({ isPositive }: { readonly isPositive: boolean }) {
  return <i className={`hint-pin ${isPositive ? "positive" : "negative"}`} aria-hidden="true" />;
}

/**
 * One line over the picture saying what the next click or drag does with the chosen tool.
 */
export function DrawingHint({ tool, activeObjectId, isPointSupported, isSequential }: DrawingHintProps) {
  if (tool === "exemplar") {
    return (
      <>
        <span className="lead">Drag a box around one example</span>
        <span className="muted">every look-alike is found</span>
        <span className="muted">
          <kbd>Ctrl/⌘</kbd> + drag: a look-alike to leave out
        </span>
        <span className="muted">
          <kbd>Esc</kbd> stop drawing
        </span>
      </>
    );
  }
  if (tool !== "mark") return null;
  if (!isPointSupported) {
    return (
      <>
        <span className="lead">Drag a box around each object</span>
        <span className="muted">
          <kbd>Esc</kbd> stop drawing
        </span>
      </>
    );
  }
  if (activeObjectId === null) {
    return (
      <>
        <span className="lead">
          <PinMark isPositive /> Click an object to cut it out
        </span>
        <span className="muted">or drag a box around it</span>
        <span className="muted">
          <kbd>Esc</kbd> stop drawing
        </span>
      </>
    );
  }
  return (
    <>
      <span>
        <PinMark isPositive /> Click to add a part
      </span>
      <span>
        <PinMark isPositive={false} /> <kbd>Ctrl/⌘</kbd> + click to leave a part out
      </span>
      <span className="muted">
        <kbd>N</kbd> {isSequential ? "next object; mark again on a later frame to correct it" : "next object"}
      </span>
    </>
  );
}
