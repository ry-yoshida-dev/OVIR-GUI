import type { TaskValue } from "../api/types";
import { Glyph } from "./Glyphs";

interface TaskGlyphProps {
  task: TaskValue;
}

export function TaskGlyph({ task }: TaskGlyphProps) {
  return (
    <Glyph className="task-glyph" viewBox="0 0 20 20">
      {task === "classification" && (
        <>
          <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M2.5 6a2.5 2.5 0 0 1 2.5-2.5h5.5v4.5H2.5z" fill="currentColor" />
        </>
      )}
      {task === "detection" && (
        <>
          <path
            d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M17 13v2.5a1.5 1.5 0 0 1-1.5 1.5H13M7 17H4.5A1.5 1.5 0 0 1 3 15.5V13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <rect x="7" y="7" width="6" height="6" rx="1" fill="currentColor" />
        </>
      )}
      {task === "segmentation" && (
        <path
          d="M6.2 4.6c2.3-1.6 5.4-1.2 7.6.4 2.4 1.8 3.4 4.8 2.3 7.6-1.1 2.9-4.3 4.6-7.4 4-3-.6-5.3-3.1-5.4-6.1-.1-2.4 1-4.6 2.9-5.9z"
          fill="currentColor"
          fillOpacity="0.3"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      )}
    </Glyph>
  );
}
