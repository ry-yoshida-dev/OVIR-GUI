import type { ReactNode } from "react";
import { type ClassColors, classColorOf, SWATCH_FALLBACK_COLOR } from "../../lib/frameView";

export interface PictureListItem {
  key: string;
  path: string;
  frame: number | null;
  label: string;
  classNames: string[];
  summary?: ReactNode;
  value: string;
  detail: ReactNode;
  share: number;
}

interface PictureListProps {
  items: PictureListItem[];
  classColors: ClassColors;
  valueLabel: string;
  emptyText: string;
  classesLabel?: string;
  onOpenPicture: (path: string, frame: number | null) => void;
}

const SHOWN_CLASS_LIMIT = 5;

/**
 * Pictures ranked by one measure, each opening in the image view when chosen.
 */
export function PictureList({
  items,
  classColors,
  valueLabel,
  emptyText,
  classesLabel = "Classes kept",
  onOpenPicture,
}: PictureListProps) {
  if (items.length === 0) return <div className="statistics-empty">{emptyText}</div>;
  return (
    <div className="picture-list" role="list">
      <div className="picture-list-head" aria-hidden="true">
        <span>Picture</span>
        <span>{classesLabel}</span>
        <span className="picture-list-value-head">{valueLabel}</span>
      </div>
      {items.map((item) => (
        <button
          key={item.key}
          role="listitem"
          className="picture-list-row"
          title={`Open ${item.label}`}
          onClick={() => onOpenPicture(item.path, item.frame)}
        >
          <span className="picture-list-name">{item.label}</span>
          <span className="picture-list-classes">
            {item.summary}
            {item.classNames.slice(0, SHOWN_CLASS_LIMIT).map((className) => (
              <span key={className} className="picture-list-class">
                <span
                  className="swatch"
                  style={{ background: classColorOf(classColors, className, SWATCH_FALLBACK_COLOR) }}
                />
                {className}
              </span>
            ))}
            {item.classNames.length > SHOWN_CLASS_LIMIT && (
              <span className="faint">+{item.classNames.length - SHOWN_CLASS_LIMIT}</span>
            )}
          </span>
          <span className="picture-list-measure">
            <span className="value-bar-track">
              <span className="value-bar-fill" style={{ width: `${Math.max(0, Math.min(1, item.share)) * 100}%` }} />
            </span>
            <span className="picture-list-value">{item.value}</span>
            <span className="picture-list-detail">{item.detail}</span>
          </span>
          <span className="picture-list-open" aria-hidden="true">
            ›
          </span>
        </button>
      ))}
    </div>
  );
}
