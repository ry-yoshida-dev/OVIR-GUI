import type { TaskState, TaskValue } from "../api/types";

interface TaskSwitcherProps {
  task: TaskState;
  isDisabled: boolean;
  onSelect: (task: TaskValue) => void;
}

export function TaskSwitcher({ task, isDisabled, onSelect }: TaskSwitcherProps) {
  return (
    <div className="segmented task-switcher" role="tablist" aria-label="Task">
      {task.options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={option.value === task.value}
          className={option.value === task.value ? "active" : ""}
          disabled={isDisabled}
          onClick={() => option.value !== task.value && onSelect(option.value)}
        >
          {option.title}
        </button>
      ))}
    </div>
  );
}
