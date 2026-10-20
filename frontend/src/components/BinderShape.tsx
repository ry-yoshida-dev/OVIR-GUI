import type { TaskValue } from "../api/types";
import { backPath, isTabAtSheetEdge, tabPath, tabXOf } from "./binderGeometry";

interface BinderShapeProps {
  task: TaskValue;
  tasks: TaskValue[];
}

export function BinderShape({ task, tasks }: BinderShapeProps) {
  const tabX = tabXOf(Math.max(0, tasks.indexOf(task)));
  const sheetColor = `var(--sheet-${task})`;
  return (
    <div className="binder-shape" aria-hidden="true">
      <svg className="binder-backs">
        {tasks.map((entry, index) =>
          entry === task ? null : (
            <path key={entry} className="back" d={backPath(tabXOf(index))} style={{ fill: `var(--back-${entry})` }} />
          ),
        )}
      </svg>
      <div className="binder-front">
        <svg className="binder-front-tab">
          <path d={tabPath(tabX)} style={{ fill: sheetColor }} />
        </svg>
        <div
          className={`binder-front-sheet${isTabAtSheetEdge(tabX) ? " is-tab-at-edge" : ""}`}
          style={{ background: sheetColor }}
        />
      </div>
    </div>
  );
}
