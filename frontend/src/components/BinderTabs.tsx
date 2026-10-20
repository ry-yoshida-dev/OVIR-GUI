import type { TaskValue } from "../api/types";
import { taskViewOf } from "../lib/taskViews";
import { BINDER_GEOMETRY, tabsWidthOf, tabXOf } from "./binderGeometry";
import { TaskGlyph } from "./TaskGlyph";

interface BinderTabsProps {
  task: TaskValue;
  tasks: TaskValue[];
  isDisabled: boolean;
  onSelect: (task: TaskValue) => void;
}

export function BinderTabs({ task, tasks, isDisabled, onSelect }: BinderTabsProps) {
  return (
    <div className="binder-tabs" role="tablist" aria-label="Task" style={{ width: tabsWidthOf(tasks.length) }}>
      {tasks.map((entry, index) => {
        const isActive = entry === task;
        return (
          <button
            key={entry}
            role="tab"
            aria-selected={isActive}
            className={`binder-tab${isActive ? " active" : ""}`}
            style={{ left: tabXOf(index), width: BINDER_GEOMETRY.tabWidth }}
            disabled={isDisabled && !isActive}
            title={`${taskViewOf(entry).label} (Ctrl+${index + 1})`}
            onClick={() => !isActive && onSelect(entry)}
          >
            <TaskGlyph task={entry} />
            <span className="label">{taskViewOf(entry).label}</span>
          </button>
        );
      })}
    </div>
  );
}
