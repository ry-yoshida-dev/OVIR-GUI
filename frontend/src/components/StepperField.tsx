import { useState } from "react";

interface StepperFieldProps {
  initialValue: number;
  minimum: number;
  maximum: number;
  unit: string;
  onChange: (value: number) => void;
}

export function StepperField({ initialValue, minimum, maximum, unit, onChange }: StepperFieldProps) {
  const [value, setValue] = useState(Math.min(maximum, Math.max(minimum, initialValue)));
  const stepBy = (delta: number) => {
    const next = Math.min(maximum, Math.max(minimum, value + delta));
    if (next === value) return;
    setValue(next);
    onChange(next);
  };
  return (
    <span className="stepper-field">
      <span className="stepper-value">
        {value} {unit}
      </span>
      <span className="stepper-buttons">
        <button type="button" disabled={value >= maximum} onClick={() => stepBy(1)} title="Increase">
          ▲
        </button>
        <button type="button" disabled={value <= minimum} onClick={() => stepBy(-1)} title="Decrease">
          ▼
        </button>
      </span>
    </span>
  );
}
