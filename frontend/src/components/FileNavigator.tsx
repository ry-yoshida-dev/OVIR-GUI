interface FileNavigatorProps {
  name: string | null;
  index: number;
  total: number;
  onNavigate: (step: number) => void;
}

export function FileNavigator({ name, index, total, onNavigate }: FileNavigatorProps) {
  return (
    <span className="file-navigator">
      <button
        className="band-arrow"
        disabled={index <= 0}
        onClick={() => onNavigate(-1)}
        title="Previous file (PageUp)"
      >
        ‹
      </button>
      <b className="file-name" title={name ?? undefined}>
        {name ?? "No file"}
      </b>
      <span className="file-position">{total === 0 ? "0 / 0" : `${index < 0 ? "–" : index + 1} / ${total}`}</span>
      <button
        className="band-arrow"
        disabled={index < 0 || index >= total - 1}
        onClick={() => onNavigate(1)}
        title="Next file (PageDown)"
      >
        ›
      </button>
    </span>
  );
}
