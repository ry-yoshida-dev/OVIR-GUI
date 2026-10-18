interface MaskShapeProps {
  polygons: number[][];
  color: string;
  opacity: number;
  isRejected: boolean;
  isHighlighted?: boolean;
  isOutlineOnly?: boolean;
  lineWidth: number;
  onClick?: () => void;
}

function pathOf(polygons: number[][]): string {
  return polygons
    .map((flat) => {
      const points: string[] = [];
      for (let index = 0; index + 1 < flat.length; index += 2) {
        points.push(`${flat[index]},${flat[index + 1]}`);
      }
      return points.length > 0 ? `M${points.join("L")}Z` : "";
    })
    .join("");
}

export function MaskShape({
  polygons,
  color,
  opacity,
  isRejected,
  isHighlighted = false,
  isOutlineOnly = false,
  lineWidth,
  onClick,
}: MaskShapeProps) {
  const path = pathOf(polygons);
  if (path === "") return null;
  return (
    <g
      opacity={isRejected ? 0.5 : 1}
      onPointerDown={(event) => {
        if (onClick !== undefined && event.button === 0 && !event.shiftKey) {
          event.stopPropagation();
          onClick();
        }
      }}
      style={{ cursor: onClick === undefined ? undefined : "pointer" }}
    >
      {isHighlighted && (
        <path d={path} fill="none" stroke="#ffffff" strokeWidth={lineWidth + 3} vectorEffect="non-scaling-stroke" />
      )}
      <path
        d={path}
        fill={isOutlineOnly ? "none" : color}
        fillOpacity={isHighlighted ? Math.min(0.85, opacity + 0.2) : opacity}
        fillRule="evenodd"
        stroke={color}
        strokeWidth={isHighlighted ? lineWidth + 1 : lineWidth}
        strokeDasharray={isRejected ? "6 4" : isOutlineOnly ? "2 3" : undefined}
        vectorEffect="non-scaling-stroke"
        pointerEvents={onClick === undefined ? "none" : "visiblePainted"}
      />
    </g>
  );
}
