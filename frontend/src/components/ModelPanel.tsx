import type { BackendEntry, ModelSelection, ModelState } from "../api/types";
import { promptInputsOf } from "../lib/promptInputs";
import { TemplateField } from "./TemplateField";

interface ModelPanelProps {
  model: ModelState;
  isDisabled: boolean;
  onSelectPreset: (backend: string, presetName: string) => void;
  onSelectionChange: (selection: ModelSelection) => void;
}

function familyOf(backend: string): string {
  return backend.slice(backend.indexOf("/") + 1);
}

export function ModelPanel({
  model,
  isDisabled,
  onSelectPreset,
  onSelectionChange,
}: ModelPanelProps) {
  const selection = model.selection;
  const backend = model.backends.find(
    (entry) => entry.value === selection.backend,
  );
  const modeBackends = model.backends.filter(
    (entry) => entry.mode === model.mode,
  );
  const selectFirstPreset = (entry: BackendEntry | undefined) => {
    const firstPreset = entry?.presets[0];
    if (entry !== undefined && firstPreset !== undefined)
      onSelectPreset(entry.value, firstPreset.name);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="form-grid">
        {model.modes.length > 1 && (
          <>
            <span>Mode</span>
            <select
              value={model.mode ?? ""}
              disabled={isDisabled}
              title="How the segmenter is told what to segment"
              onChange={(event) =>
                selectFirstPreset(
                  model.backends.find(
                    (entry) => entry.mode === event.target.value,
                  ),
                )
              }
            >
              {model.modes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.title}
                </option>
              ))}
            </select>
          </>
        )}
        <span>Backend</span>
        <select
          value={selection.backend}
          disabled={isDisabled}
          onChange={(event) =>
            selectFirstPreset(
              model.backends.find(
                (entry) => entry.value === event.target.value,
              ),
            )
          }
        >
          {modeBackends.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {familyOf(entry.value)}
            </option>
          ))}
        </select>
        <span>Preset</span>
        <select
          value={selection.preset_name}
          disabled={isDisabled}
          title={model.weights_path}
          onChange={(event) =>
            onSelectPreset(selection.backend, event.target.value)
          }
        >
          {(backend?.presets ?? []).map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
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
        <span>Inputs</span>
        <div className="input-tags">
          {promptInputsOf(model).map((input) => (
            <span key={input.label} className="input-tag" title={input.hint}>
              {input.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
