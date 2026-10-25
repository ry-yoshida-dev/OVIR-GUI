import type { LabelModeState, LabelModeValue } from "../api/types";

interface LabelModeSwitchProps {
  labelMode: LabelModeState;
  onChange: (labelMode: LabelModeValue) => void;
}

const LABEL_MODE_HINT =
  "Single: each picture gets only its best class. " +
  "Multi: each picture gets every class reaching its minimum in the Review panel. " +
  "Switching needs no new inference.";

/**
 * Chooses whether a classified picture gets one class or every class reaching its minimum.
 */
export function LabelModeSwitch({ labelMode, onChange }: LabelModeSwitchProps) {
  return (
    <span
      className="segmented label-mode-switch"
      role="radiogroup"
      aria-label="Classes per picture"
      title={LABEL_MODE_HINT}
    >
      {labelMode.modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          role="radio"
          aria-checked={mode.value === labelMode.value}
          className={mode.value === labelMode.value ? "active" : ""}
          onClick={() => onChange(mode.value)}
        >
          {mode.title}
        </button>
      ))}
    </span>
  );
}
