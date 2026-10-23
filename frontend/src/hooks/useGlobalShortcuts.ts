import { useEffect, useEffectEvent } from "react";
import type { TaskValue } from "../api/types";
import { isAnyDialogOpen } from "../components/Dialog";
import { TASK_ORDER } from "../lib/taskViews";

interface GlobalShortcutHandlers {
  onSelectTask: (task: TaskValue) => void;
  onExport: () => void;
  onToggleStatistics: () => void;
  onBrowse: () => void;
}

const TASK_KEYS = ["1", "2", "3"];

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Handles the Ctrl or Command shortcuts of the whole window while no dialog is open: 1 to 3 pick a task, E exports,
 * I toggles the statistics and O opens media from the server; the letters are left to fields being typed in.
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const isCommand = event.metaKey || event.ctrlKey;
    if (!isCommand || isAnyDialogOpen()) return;
    const shortcutTask = TASK_ORDER[TASK_KEYS.indexOf(event.key)];
    if (shortcutTask !== undefined && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      handlers.onSelectTask(shortcutTask);
      return;
    }
    if (isTyping(event.target)) return;
    const letterHandlers: Record<string, (() => void) | undefined> = {
      e: handlers.onExport,
      i: handlers.onToggleStatistics,
      o: handlers.onBrowse,
    };
    const handler = letterHandlers[event.key.toLowerCase()];
    if (handler === undefined) return;
    event.preventDefault();
    handler();
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKeyDown(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
