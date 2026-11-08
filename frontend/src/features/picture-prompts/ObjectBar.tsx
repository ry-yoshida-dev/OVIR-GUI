import type { MarkEntry } from "@/api/types";
import { TrashGlyph } from "@/components/Glyphs";

interface ObjectBarProps {
  readonly mark: MarkEntry;
  readonly color: string;
  readonly isSequential: boolean;
  readonly onFinish: () => void;
  readonly onRemove: () => void;
  readonly onRemoveEverywhere: () => void;
}

function contentOf(mark: MarkEntry): string {
  const parts: string[] = [];
  if (mark.positive_points.length > 0) parts.push(`${mark.positive_points.length} +`);
  if (mark.negative_points.length > 0) parts.push(`${mark.negative_points.length} −`);
  if (mark.box !== null) parts.push("box");
  return parts.join(" · ");
}

/**
 * Bar next to the object being marked: which object it is, and buttons to finish or remove it.
 */
export function ObjectBar({ mark, color, isSequential, onFinish, onRemove, onRemoveEverywhere }: ObjectBarProps) {
  return (
    <div className="object-bar">
      <span className="object-bar-name">
        <span className="swatch" style={{ background: color }} />
        Object {mark.object_id} · {mark.class_name}
        <span className="object-bar-content">{contentOf(mark)}</span>
      </span>
      <button className="object-bar-done" title="Finish this object; the next click starts a new one (N)" onClick={onFinish}>
        Done
      </button>
      <button
        className="object-bar-remove"
        title={isSequential ? "Remove the mark of this object on this frame (Delete)" : "Remove this object (Delete)"}
        aria-label={isSequential ? "Unmark here" : "Remove object"}
        onClick={onRemove}
      >
        <TrashGlyph />
        {isSequential && <span>Here</span>}
      </button>
      {isSequential && (
        <button
          className="object-bar-remove"
          title="Remove the object from every frame"
          aria-label="Delete object"
          onClick={onRemoveEverywhere}
        >
          <TrashGlyph />
          <span>All frames</span>
        </button>
      )}
    </div>
  );
}
