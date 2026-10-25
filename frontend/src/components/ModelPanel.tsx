import { useState } from "react";
import type { ModelSelection, ModelState } from "../api/types";
import { familyOf } from "../lib/modelFamily";
import { ModelLibraryDialog } from "./ModelLibraryDialog";
import { TemplateField } from "./TemplateField";

interface ModelPanelProps {
  model: ModelState;
  isDisabled: boolean;
  onSelectPreset: (backend: string, presetName: string) => void;
  onSelectionChange: (selection: ModelSelection) => void;
}

export function ModelPanel({
  model,
  isDisabled,
  onSelectPreset,
  onSelectionChange,
}: ModelPanelProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const selection = model.selection;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="form-grid">
        <span>Backend / Preset</span>
        <button
          className="model-picker"
          disabled={isDisabled}
          title={`${model.weights_path}\nClick to compare and choose models`}
          onClick={() => setIsLibraryOpen(true)}
        >
          <span className="model-picker-name">
            <span className="small muted">{familyOf(selection.backend)}</span>
            <span>{selection.preset_name}</span>
          </span>
          <span className="model-picker-chevron" aria-hidden>
            ›
          </span>
        </button>
        {model.text_templates !== null && (
          <>
            <span className="form-grid-top">Template</span>
            <TemplateField
              templates={model.text_templates}
              isDisabled={isDisabled}
              onCommit={(templates) =>
                onSelectionChange({ ...selection, text_templates: templates })
              }
            />
          </>
        )}
      </div>
      {isLibraryOpen && (
        <ModelLibraryDialog
          model={model}
          backends={model.backends}
          onSelectPreset={onSelectPreset}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}
    </div>
  );
}
