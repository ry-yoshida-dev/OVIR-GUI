import type { InferenceModeValue, InferenceState } from "../api/types";
import { NumberField } from "./NumberField";

interface InferenceModeSettingsProps {
  inference: InferenceState;
  frameStep: number;
  onChange: (mode: InferenceModeValue, isAuto: boolean) => void;
  onRetry: () => void;
  onFrameStepChange: (frameStep: number) => void;
}

export function InferenceModeSettings({ inference, frameStep, onChange, onRetry, onFrameStepChange }: InferenceModeSettingsProps) {
  return (
    <div className="form-grid">
      <span>Auto</span>
      <label title="Infer the scope below automatically while you work; when off, only the Infer button runs it">
        <input
          type="checkbox"
          checked={inference.is_auto}
          onChange={(event) => onChange(inference.mode, event.target.checked)}
        />
        Infer automatically
      </label>
      <span>Scope</span>
      <select
        value={inference.mode}
        title="Current view: the image or video frame on screen. All files: every open image, and every video throughout at the frequency below."
        onChange={(event) => onChange(event.target.value as InferenceModeValue, inference.is_auto)}
      >
        {inference.modes.map((mode) => (
          <option key={mode.value} value={mode.value}>
            {mode.label}
          </option>
        ))}
      </select>
      <span title="A video is inferred every Nth frame; frames in between show the previous result">
        Video
      </span>
      <div className="row">
        <span className="small muted">every</span>
        <NumberField value={frameStep} minimum={1} maximum={100000} step={1} width={60} onCommit={(value) => onFrameStepChange(Math.round(value))} />
        <span className="small muted">frames</span>
      </div>
      {inference.pause_reason !== null && (
        <div className="paused-notice" style={{ gridColumn: "1 / -1" }}>
          <span className="paused-text">Automatic inference stopped after an error:</span>
          <span className="paused-reason">{inference.pause_reason}</span>
          <button onClick={onRetry} title="Clear the error and infer automatically again">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
