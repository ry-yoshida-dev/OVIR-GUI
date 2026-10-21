import type { BelowMinimumStyle, DisplayOptions } from "../lib/displayOptions";
import type { TaskView } from "../lib/taskViews";
import { StepperField } from "./StepperField";

interface ViewSettingsProps {
  taskView: TaskView;
  display: DisplayOptions;
  isComparisonAvailable: boolean;
  onChange: (display: DisplayOptions) => void;
}

const MINIMUM_LINE_WIDTH = 1;
const MAXIMUM_LINE_WIDTH = 10;
const MASK_OPACITIES = [0.25, 0.45, 0.65];
const BELOW_MINIMUM_STYLES: { value: BelowMinimumStyle; label: string }[] = [
  { value: "dim", label: "Dimmed" },
  { value: "hide", label: "Hidden" },
];

export function ViewSettings({
  taskView,
  display,
  isComparisonAvailable,
  onChange,
}: ViewSettingsProps) {
  return (
    <div className="settings-group">
      <div className="settings-toggles">
        {taskView.displayToggles.map((toggle) => {
          const isDisabled =
            toggle.key === "isComparedShown" && !isComparisonAvailable;
          return (
            <label key={toggle.key} className={isDisabled ? "disabled" : ""}>
              <input
                type="checkbox"
                checked={display[toggle.key]}
                disabled={isDisabled}
                onChange={(event) =>
                  onChange({ ...display, [toggle.key]: event.target.checked })
                }
              />
              {toggle.label}
            </label>
          );
        })}
      </div>
      <div className="form-grid">
        <span>Filtered out</span>
        <select
          value={display.belowMinimum}
          title="How findings below their confidence threshold or removed as duplicates in Review are shown"
          onChange={(event) => {
            const style = BELOW_MINIMUM_STYLES.find(
              (option) => option.value === event.target.value,
            );
            if (style !== undefined)
              onChange({ ...display, belowMinimum: style.value });
          }}
        >
          {BELOW_MINIMUM_STYLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {taskView.isLineWidthShown && (
          <>
            <span>Line width</span>
            <StepperField
              initialValue={display.lineWidth}
              minimum={MINIMUM_LINE_WIDTH}
              maximum={MAXIMUM_LINE_WIDTH}
              unit="px"
              onChange={(width) => onChange({ ...display, lineWidth: width })}
            />
          </>
        )}
        {taskView.isMaskOpacityShown && (
          <>
            <span>Mask opacity</span>
            <select
              value={display.maskOpacity}
              onChange={(event) =>
                onChange({
                  ...display,
                  maskOpacity: Number(event.target.value),
                })
              }
            >
              {MASK_OPACITIES.map((opacity) => (
                <option key={opacity} value={opacity}>
                  {Math.round(opacity * 100)}%
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
