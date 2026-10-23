import type { DragEvent } from "react";
import { api } from "../../api/client";
import type { ReferenceEntry } from "../../api/types";

interface ReferenceRowProps {
  reference: ReferenceEntry;
  isSelected: boolean;
  isImagePromptSupported: boolean;
  onSelect: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
}

export function ReferenceRow({
  reference,
  isSelected,
  isImagePromptSupported,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
}: ReferenceRowProps) {
  return (
    <div
      className={["tree-row child", isSelected ? "selected" : "", isImagePromptSupported ? "" : "disabled"].join(" ")}
      title={
        isImagePromptSupported
          ? `${reference.boxes.length} boxes on ${reference.name}`
          : "The selected model does not take image prompts"
      }
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={onSelect}
    >
      <img className="thumb" src={api.referenceImageUrl(reference.name, reference.digest)} alt="" />
      <span className="label">{reference.name}</span>
      <span className="faint small">
        {reference.boxes.length} box{reference.boxes.length === 1 ? "" : "es"}
      </span>
    </div>
  );
}
