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
          <rect x="2.5" y="3.5" width="15" height="3" rx="1.5" fill="currentColor" />
          <rect x="2.5" y="8.5" width="9.5" height="3" rx="1.5" fill="currentColor" fillOpacity="0.45" />
          <rect x="2.5" y="13.5" width="5.5" height="3" rx="1.5" fill="currentColor" fillOpacity="0.45" />
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
          d="M4.2 9.8C3.4 7 5.6 4.6 8.2 5.4C9.6 5.8 10.2 5.2 11.4 4C13 2.4 16 3.2 15.6 5.6C15.3 7.2 13.6 7.6 13.9 9.4C14.1 10.6 16.4 11.2 16.2 13.6C16 16.4 12.6 17.4 10.6 15.8C9.6 15 8.6 15.4 7.4 16C5 17.2 2.6 15 3.6 12.8C4 11.9 4.4 10.9 4.2 9.8Z"
          fill="currentColor"
          fillOpacity="0.3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
    </Glyph>
  );
}
