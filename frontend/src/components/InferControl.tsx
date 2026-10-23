import type { InferenceModeValue, InferenceState } from "../api/types";
import { GearGlyph } from "./Glyphs";
import { InferenceModeSettings } from "./InferenceModeSettings";
import { PopoverButton } from "./PopoverButton";

interface InferControlProps {
  isDisabled: boolean;
  inference: InferenceState;
  frameStep: number;
  onInfer: () => void;
  onInferenceChange: (mode: InferenceModeValue, isAuto: boolean) => void;
  onRetry: () => void;
  onFrameStepChange: (frameStep: number) => void;
}

export function InferControl({ isDisabled, inference, frameStep, onInfer, onInferenceChange, onRetry, onFrameStepChange }: InferControlProps) {
  const label = inference.modes.find((mode) => mode.value === inference.mode)?.label ?? inference.mode;
  return (
    <div className="infer-control">
      <button className="infer-button" disabled={isDisabled} onClick={onInfer} title={`Infer: ${label.toLowerCase()}`}>
        Infer
        <span className="infer-scope">
          {label}
          {inference.is_auto ? " · auto" : ""}
        </span>
      </button>
      <PopoverButton
        className="infer-settings"
        label="Inference mode"
        title={inference.pause_reason !== null ? "Automatic inference stopped after an error" : "What is inferred"}
        trigger={
          <>
            <GearGlyph />
            {inference.pause_reason !== null && <span className="attention-badge" />}
          </>
        }
        isOpeningUpward
      >
        <div className="popover-title">Inference</div>
        <InferenceModeSettings
          inference={inference}
          frameStep={frameStep}
          onChange={onInferenceChange}
          onRetry={onRetry}
          onFrameStepChange={onFrameStepChange}
        />
      </PopoverButton>
    </div>
  );
}
