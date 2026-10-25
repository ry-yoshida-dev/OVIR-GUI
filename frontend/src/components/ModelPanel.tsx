import { useState } from "react";
import { api } from "../api/client";
import type { ModelSelection, ModelState } from "../api/types";
import type { Call } from "../hooks/useActionRunner";
import { familyOf } from "../lib/modelFamily";
import { ModelLibraryDialog } from "./ModelLibraryDialog";
import { AggregationField } from "./AggregationField";
import { TemplateField } from "./TemplateField";
import type { TemplateChoice } from "./TemplatePanel";

interface ModelPanelProps {
  model: ModelState;
  isDisabled: boolean;
  examplePrompt: string;
  call: Call;
  onReport: (text: string) => void;
  onSelectPreset: (backend: string, presetName: string) => void;
  onSelectionChange: (selection: ModelSelection) => void;
}

export function ModelPanel({
  model,
  isDisabled,
  examplePrompt,
  call,
  onReport,
  onSelectPreset,
  onSelectionChange,
}: ModelPanelProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const selection = model.selection;
  const changeTemplates = async ({ saved, inUse }: TemplateChoice) => {
    if (saved.join("\n") !== model.saved_templates.join("\n")) {
      if (!(await call(() => api.setTextTemplates(saved)))) return;
    }
    if (inUse.join("\n") !== (model.text_templates ?? []).join("\n"))
      onSelectionChange({ ...selection, text_templates: inUse });
  };
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
            <span>Templates</span>
            <TemplateField
              templates={model.text_templates}
              savedTemplates={model.saved_templates}
              examplePrompt={examplePrompt}
              isDisabled={isDisabled}
              onChange={(choice) => void changeTemplates(choice)}
              onReport={onReport}
            />
          </>
        )}
        {model.aggregation !== null && model.score_activation !== null && (
          <>
            <span>Aggregation</span>
            <AggregationField
              steps={model.aggregation}
              methods={model.aggregation_methods}
              activation={model.score_activation}
              isDisabled={isDisabled}
              onChange={(steps) => onSelectionChange({ ...selection, aggregation: steps })}
            />
          </>
        )}
      </div>
      {isLibraryOpen && (
        <ModelLibraryDialog
          model={model}
          backends={model.backends}
          call={call}
          onSelectPreset={onSelectPreset}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}
    </div>
  );
}
