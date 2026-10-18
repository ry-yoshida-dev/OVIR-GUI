import type { BackgroundState } from "../api/types";

interface BackgroundControlProps {
  background: BackgroundState;
  onChange: (scope: string) => void;
}

export function BackgroundControl({ background, onChange }: BackgroundControlProps) {
  return (
    <label className="background-control" title="Which pictures are recognized automatically while you work">
      Auto
      <select value={background.scope} onChange={(event) => onChange(event.target.value)}>
        {background.scopes.map((scope) => (
          <option key={scope.value} value={scope.value}>
            {scope.label}
          </option>
        ))}
      </select>
      {background.is_paused && (
        <span className="paused" title="Background recognition paused after an error; any action resumes it.">
          paused
        </span>
      )}
    </label>
  );
}
