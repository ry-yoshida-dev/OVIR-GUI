import { type RefObject, useEffect, useState } from "react";
import { copyAnnotatedSnapshot, type ShownPicture } from "../lib/annotatedSnapshot";
import { CheckGlyph, CopyGlyph } from "./Glyphs";

interface CopyPictureButtonProps {
  shownPicture: RefObject<ShownPicture | null>;
  isDisabled: boolean;
}

type CopyState = { kind: "idle" } | { kind: "copying" } | { kind: "copied" } | { kind: "failed"; reason: string };

const NOTE_MILLISECONDS = 1600;

/**
 * Copies the picture in the viewer with its findings drawn, at full size.
 */
export function CopyPictureButton({ shownPicture, isDisabled }: CopyPictureButtonProps) {
  const [state, setState] = useState<CopyState>({ kind: "idle" });

  useEffect(() => {
    if (state.kind !== "copied" && state.kind !== "failed") return;
    const timer = window.setTimeout(() => setState({ kind: "idle" }), NOTE_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = () => {
    const picture = shownPicture.current;
    if (picture === null) {
      setState({ kind: "failed", reason: "The picture is not shown yet" });
      return;
    }
    setState({ kind: "copying" });
    copyAnnotatedSnapshot(picture).then(
      () => setState({ kind: "copied" }),
      (error: unknown) => setState({ kind: "failed", reason: error instanceof Error ? error.message : String(error) }),
    );
  };

  return (
    <button
      className="sheet-button"
      disabled={isDisabled || state.kind === "copying"}
      title={
        state.kind === "failed"
          ? `Could not copy: ${state.reason}`
          : "Copy the picture with its findings drawn, at full size"
      }
      onClick={copy}
    >
      {state.kind === "copied" ? <CheckGlyph /> : <CopyGlyph />}
      {state.kind === "copied" ? "Copied" : state.kind === "failed" ? "Failed" : "Copy"}
    </button>
  );
}
