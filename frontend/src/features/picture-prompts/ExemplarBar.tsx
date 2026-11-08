import type { ExemplarEntry } from "@/api/types";
import { TrashGlyph } from "@/components/Glyphs";

interface ExemplarBarProps {
  readonly exemplar: ExemplarEntry;
  readonly color: string;
  readonly onDone: () => void;
  readonly onRemove: () => void;
}

/**
 * Bar next to the chosen exemplar box: which box it is, and buttons to let it go or remove it.
 */
export function ExemplarBar({ exemplar, color, onDone, onRemove }: ExemplarBarProps) {
  return (
    <div className="object-bar">
      <span className="object-bar-name">
        <span className="swatch" style={{ background: color }} />
        Exemplar {exemplar.index + 1} · {exemplar.class_name}
        <span className="object-bar-content">{exemplar.is_positive ? "Match" : "Not this"}</span>
      </span>
      <button className="object-bar-done" title="Stop choosing this exemplar (Esc)" onClick={onDone}>
        Done
      </button>
      <button className="object-bar-remove" title="Remove this exemplar (Delete)" aria-label="Remove exemplar" onClick={onRemove}>
        <TrashGlyph />
      </button>
    </div>
  );
}
