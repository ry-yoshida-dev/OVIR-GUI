import type { ModelSelection, ModelState, TaskValue } from "../api/types";
import { taskViewOf } from "../lib/taskViews";
import { NumberField } from "./NumberField";

interface InferenceSettingsProps {
  model: ModelState;
  task: TaskValue;
  isDisabled: boolean;
  onChange: (selection: ModelSelection) => void;
}

const TILING_CHOICES = [null, 2, 3, 4];

export function InferenceSettings({
  model,
  task,
  isDisabled,
  onChange,
}: InferenceSettingsProps) {
  const selection = model.selection;
  const backend = model.backends.find((entry) => entry.value === selection.backend);
  const change = (update: Partial<ModelSelection>) => onChange({ ...selection, ...update });
  const taskView = taskViewOf(task);
  const confidenceLabel = model.tuning.confidence_label;
  const batchSize = selection.batch_size;
  return (
    <div className="form-grid">
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
      {batchSize !== null && (
        <>
          <span>Batch size</span>
          <span
            className="stepper-field"
            title="Pictures inferred together; results appear once a whole batch is done, so 1 shows each result soonest on a slow machine, and too large a batch runs out of GPU memory"
          >
            <span className="stepper-value">{batchSize}</span>
            <span className="stepper-buttons">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => change({ batch_size: batchSize * 2 })}
                title="Double"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={isDisabled || batchSize <= 1}
                onClick={() => change({ batch_size: batchSize / 2 })}
                title="Halve"
              >
                ▼
              </button>
            </span>
          </span>
        </>
      )}
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
      {(backend?.is_box_prompted ?? false) && (
        <>
          <span>Boxes from</span>
          <select
            value={selection.box_detector_label ?? ""}
            disabled={isDisabled}
            title="Open-vocabulary detector finding the boxes the segmenter masks"
            onChange={(event) => change({ box_detector_label: event.target.value === "" ? null : event.target.value })}
          >
            <option value="">Preset detector</option>
            {model.box_detectors.map((entry) => (
              <option key={entry.label} value={entry.label}>
                {entry.label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
