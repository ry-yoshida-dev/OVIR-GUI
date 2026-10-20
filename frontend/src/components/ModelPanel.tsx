import type { BackendEntry, ModelSelection, ModelState, TaskValue } from "../api/types";
import { taskViewOf } from "../lib/taskViews";
import { NumberField } from "./NumberField";

interface ModelPanelProps {
  model: ModelState;
  task: TaskValue;
  isDisabled: boolean;
  onSelectPreset: (backend: string, presetName: string) => void;
  onChange: (selection: ModelSelection) => void;
}

const TILING_CHOICES = [null, 2, 3, 4];

function familyOf(backend: string): string {
  return backend.slice(backend.indexOf("/") + 1);
}

export function ModelPanel({ model, task, isDisabled, onSelectPreset, onChange }: ModelPanelProps) {
  const selection = model.selection;
  const backend = model.backends.find((entry) => entry.value === selection.backend);
  const change = (update: Partial<ModelSelection>) => onChange({ ...selection, ...update });
  const taskView = taskViewOf(task);
  const isBoxPrompted = backend?.is_box_prompted ?? false;
  const modeBackends = model.backends.filter((entry) => entry.mode === model.mode);
  const selectFirstPreset = (entry: BackendEntry | undefined) => {
    const firstPreset = entry?.presets[0];
    if (entry !== undefined && firstPreset !== undefined) onSelectPreset(entry.value, firstPreset.name);
  };
  const confidenceLabel = model.tuning.confidence_label;
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
              onChange={(event) => selectFirstPreset(model.backends.find((entry) => entry.mode === event.target.value))}
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
          onChange={(event) => selectFirstPreset(model.backends.find((entry) => entry.value === event.target.value))}
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
          onChange={(event) => onSelectPreset(selection.backend, event.target.value)}
        >
          {(backend?.presets ?? []).map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
        <span>Device</span>
        <select value={selection.device} disabled={isDisabled} onChange={(event) => change({ device: event.target.value })}>
          {model.devices.map((entry) => (
            <option key={entry.value} value={entry.value} disabled={!entry.is_available}>
              {entry.value}
              {entry.is_available ? "" : " (unavailable)"}
            </option>
          ))}
        </select>
        <span>Precision</span>
        <select value={selection.precision} disabled={isDisabled} onChange={(event) => change({ precision: event.target.value })}>
          {model.precisions.map((entry) => (
            <option key={entry.value} value={entry.value} disabled={!entry.is_available}>
              {entry.label}
              {entry.is_available ? "" : " (unavailable)"}
            </option>
          ))}
        </select>
        {taskView.isEmbeddingTuningShown && (
          <>
            <span>Pooling</span>
            <select
              value={selection.image_pooling ?? ""}
              disabled={isDisabled}
              onChange={(event) => change({ image_pooling: event.target.value })}
              title="How the image tokens are pooled into the embedding"
            >
              {(backend?.image_poolings ?? []).map((pooling) => (
                <option key={pooling} value={pooling}>
                  {pooling}
                </option>
              ))}
            </select>
            <span>Tiling</span>
            <select
              value={selection.tiling_grid_size ?? ""}
              disabled={isDisabled}
              title="Also classify overlapping tiles of each picture, so small objects count"
              onChange={(event) =>
                change({ tiling_grid_size: event.target.value === "" ? null : Number(event.target.value) })
              }
            >
              {TILING_CHOICES.map((choice) => (
                <option key={choice ?? "off"} value={choice ?? ""}>
                  {choice === null ? "Off" : `${choice}×${choice} tiles + whole`}
                </option>
              ))}
            </select>
          </>
        )}
        {confidenceLabel !== null && (
          <>
            <span>{confidenceLabel}</span>
            <NumberField
              value={selection.confidence_threshold ?? 0}
              isDisabled={isDisabled}
              onCommit={(value) => change({ confidence_threshold: value })}
            />
          </>
        )}
        {model.tuning.is_nms_shown && (
          <>
            <span>NMS</span>
            <div className="row">
              <label>
                <input
                  type="checkbox"
                  checked={selection.nms_iou_threshold !== null}
                  disabled={isDisabled}
                  onChange={(event) => change({ nms_iou_threshold: event.target.checked ? 0.5 : null })}
                />
                IoU
              </label>
              <div className="grow" style={{ display: "flex" }}>
                <NumberField
                  value={selection.nms_iou_threshold ?? 0.5}
                  isDisabled={isDisabled || selection.nms_iou_threshold === null}
                  onCommit={(value) => change({ nms_iou_threshold: value })}
                  width={90}
                />
              </div>
            </div>
          </>
        )}
        {isBoxPrompted && (
          <>
            <span>Boxes from</span>
            <select
              value={selection.box_detector_label ?? ""}
              disabled={isDisabled}
              title="Open-vocabulary detector finding the boxes the segmenter masks"
              onChange={(event) =>
                change({
                  box_detector_label: event.target.value === "" ? null : event.target.value,
                  box_confidence_threshold: null,
                })
              }
            >
              <option value="">Preset detector</option>
              {model.box_detectors.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <span>Box conf.</span>
            <NumberField
              value={selection.box_confidence_threshold ?? 0}
              isDisabled={isDisabled}
              onCommit={(value) => change({ box_confidence_threshold: value })}
            />
          </>
        )}
      </div>
      {model.description !== "" && <div className="hint">{model.description}</div>}
      <div className="hint">
        {model.prompt_mode === "automatic"
          ? "Queries: none (every region is segmented)"
          : `Queries: ${model.query_kinds.join(" + ")}`}
        {model.prompt_mode === "classes" && !model.is_image_prompt_supported
          ? " (image prompts are not used by this model)"
          : ""}
        {model.is_sequential ? " · tracks through videos" : ""}
      </div>
    </div>
  );
}
