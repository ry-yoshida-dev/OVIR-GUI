export interface ShareSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface ShareBarProps {
  segments: ShareSegment[];
  total?: number;
  height?: number;
}

/**
 * Horizontal bar split into segments by their share of the total, each naming its value when hovered; without a
 * total the segments fill the whole bar.
 */
export function ShareBar({ segments, total, height = 8 }: ShareBarProps) {
  const sum = segments.reduce((running, segment) => running + segment.value, 0);
  const whole = Math.max(total ?? sum, 1);
  return (
    <div className="share-bar" style={{ height }}>
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <div
            key={segment.key}
            className="share-bar-segment"
            style={{ flexBasis: `${(segment.value / whole) * 100}%`, background: segment.color }}
            title={`${segment.label}: ${segment.value.toLocaleString("en-US")}`}
          />
        ))}
    </div>
  );
}
