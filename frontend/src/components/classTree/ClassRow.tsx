import type { DragEvent, MouseEvent, ReactNode } from "react";
import type { ClassEntry } from "../../api/types";
import type { DropTarget } from "./classTreeModel";

interface ClassRowProps {
  entry: ClassEntry;
  classIndex: number;
  isExpanded: boolean;
  isSelected: boolean;
  isDropInto: boolean;
  isDropBefore: boolean;
  isDisabled: boolean;
  renameInput: ReactNode | null;
  onSelect: () => void;
  onRename: () => void;
  onToggleExpanded: () => void;
  onContextMenu: (event: MouseEvent) => void;
  onDragOver: (event: DragEvent, target: DropTarget) => void;
}

const BEFORE_CLASS_RATIO = 0.3;

function countsTextOf(entry: ClassEntry): string {
  return [
    entry.phrases.length === 1 && entry.phrases[0] === entry.name
      ? ""
      : `${entry.phrases.length} prompt${entry.phrases.length === 1 ? "" : "s"}`,
    entry.references.length > 0 ? `${entry.references.length} image${entry.references.length === 1 ? "" : "s"}` : "",
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

export function ClassRow({
  entry,
  classIndex,
  isExpanded,
  isSelected,
  isDropInto,
  isDropBefore,
  isDisabled,
  renameInput,
  onSelect,
  onRename,
  onToggleExpanded,
  onContextMenu,
  onDragOver,
}: ClassRowProps) {
  return (
    <div
      className={[
        "tree-row",
        isSelected ? "selected" : "",
        isDropInto ? "drop-into" : "",
        isDropBefore ? "drop-before" : "",
        isDisabled ? "disabled" : "",
      ].join(" ")}
      onClick={onSelect}
      onDoubleClick={onRename}
      onContextMenu={onContextMenu}
      onDragOver={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const isUpper = event.clientY - bounds.top < bounds.height * BEFORE_CLASS_RATIO;
        onDragOver(event, isUpper ? { kind: "before-class", classIndex } : { kind: "into-class", classIndex });
      }}
    >
      <span
        className="toggle"
        onClick={(event) => {
          event.stopPropagation();
          onToggleExpanded();
        }}
      >
        {isExpanded ? "▾" : "▸"}
      </span>
      <span className="swatch" style={{ background: entry.color }} />
      {renameInput ?? (
        <>
          <span className="label" title={entry.phrases.join(", ")}>
            {entry.name}
          </span>
          <span className="faint small">{countsTextOf(entry)}</span>
        </>
      )}
    </div>
  );
}
