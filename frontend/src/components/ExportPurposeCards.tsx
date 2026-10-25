import type { ReactNode } from "react";
import type { ExportPurposeValue } from "../api/types";
import { AnnotationsGlyph, ClassFoldersGlyph, CropGlyph } from "./Glyphs";

interface ExportPurposeCardsProps {
  purposes: { value: ExportPurposeValue; label: string; description: string }[];
  selected: ExportPurposeValue;
  onSelect: (purpose: ExportPurposeValue) => void;
}

const PURPOSE_GLYPHS: Record<ExportPurposeValue, ReactNode> = {
  annotations: <AnnotationsGlyph />,
  crops: <CropGlyph />,
  class_folders: <ClassFoldersGlyph />,
};

/**
 * Cards choosing what an export gives: files listing the findings, cropped objects or class folders.
 */
export function ExportPurposeCards({ purposes, selected, onSelect }: ExportPurposeCardsProps) {
  return (
    <div className="export-purposes" role="radiogroup" aria-label="What to export">
      {purposes.map((purpose) => (
        <button
          key={purpose.value}
          type="button"
          role="radio"
          aria-checked={purpose.value === selected}
          className={`export-purpose${purpose.value === selected ? " active" : ""}`}
          onClick={() => onSelect(purpose.value)}
        >
          {PURPOSE_GLYPHS[purpose.value]}
          <span className="export-purpose-text">
            <span className="export-purpose-title">{purpose.label}</span>
            <span className="export-purpose-description">{purpose.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
