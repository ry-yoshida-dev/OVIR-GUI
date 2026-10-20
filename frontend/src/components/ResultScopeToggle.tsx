import type { ResultScope } from "../lib/resultTable";

interface ResultScopeToggleProps {
  scope: ResultScope;
  onChange: (scope: ResultScope) => void;
}

const RESULT_SCOPES: { scope: ResultScope; label: string; title: string }[] = [
  { scope: "images", label: "Images", title: "Results of the open images" },
  { scope: "videos", label: "Videos", title: "Findings on the recognized frames of the open videos" },
];

export function ResultScopeToggle({ scope, onChange }: ResultScopeToggleProps) {
  return (
    <div className="segmented result-scope-toggle" role="tablist" aria-label="Results of">
      {RESULT_SCOPES.map((entry) => (
        <button
          key={entry.scope}
          role="tab"
          aria-selected={entry.scope === scope}
          className={entry.scope === scope ? "active" : ""}
          title={entry.title}
          onClick={() => onChange(entry.scope)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
