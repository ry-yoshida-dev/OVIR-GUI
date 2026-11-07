import type { DragEvent, ReactNode } from "react";

interface PhraseRowProps {
  phrase: string;
  isSelected: boolean;
  isDropBefore: boolean;
  isDraggable: boolean;
  renameInput: ReactNode | null;
  onSelect: () => void;
  onRename: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
}

export function PhraseRow({
  phrase,
  isSelected,
  isDropBefore,
  isDraggable,
  renameInput,
  onSelect,
  onRename,
  onDragStart,
  onDragEnd,
  onDragOver,
}: PhraseRowProps) {
  return (
    <div
      className={["tree-row child", isSelected ? "selected" : "", isDropBefore ? "drop-before" : ""].join(" ")}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={onSelect}
      onDoubleClick={onRename}
    >
      <span className="faint">“</span>
      {renameInput ?? <span className="label">{phrase}</span>}
    </div>
  );
}
