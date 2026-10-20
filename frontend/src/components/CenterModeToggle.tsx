export type CenterMode = "gallery" | "image";

interface CenterModeToggleProps {
  mode: CenterMode;
  onChange: (mode: CenterMode) => void;
}

const CENTER_MODES: { mode: CenterMode; label: string }[] = [
  { mode: "gallery", label: "Gallery" },
  { mode: "image", label: "Image" },
];

export function CenterModeToggle({ mode, onChange }: CenterModeToggleProps) {
  return (
    <div className="segmented center-mode-toggle" role="tablist" aria-label="Center view">
      {CENTER_MODES.map((entry) => (
        <button
          key={entry.mode}
          role="tab"
          aria-selected={entry.mode === mode}
          className={entry.mode === mode ? "active" : ""}
          onClick={() => onChange(entry.mode)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
