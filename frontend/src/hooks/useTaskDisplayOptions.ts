import { useCallback, useMemo } from "react";
import type { TaskValue } from "../api/types";
import {
  DEFAULT_DISPLAY_OPTIONS,
  type DisplayOptions,
} from "../lib/displayOptions";
import { useStoredState } from "./useStoredState";

type DisplayOptionsByTask = Partial<Record<TaskValue, Partial<DisplayOptions>>>;

const NO_STORED_OPTIONS: DisplayOptionsByTask = {};

export function useTaskDisplayOptions(
  task: TaskValue,
): [DisplayOptions, (display: DisplayOptions) => void] {
  const [stored, setStored] = useStoredState<DisplayOptionsByTask>(
    "ovir-gui.display-by-task",
    NO_STORED_OPTIONS,
  );
  const display = useMemo(
    () => ({ ...DEFAULT_DISPLAY_OPTIONS, ...stored[task] }),
    [stored, task],
  );
  const setDisplay = useCallback(
    (next: DisplayOptions) =>
      setStored((current) => ({ ...current, [task]: next })),
    [setStored, task],
  );
  return [display, setDisplay];
}
