import type { MenuEntry } from "./Menu";

const RUN_SHORTCUT: string = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘↵" : "Ctrl+↵";

interface RunButtonProps {
  isDisabled: boolean;
  onRun: () => void;
  onRunAll: () => void;
  onOpenMenu: (target: HTMLElement, entries: MenuEntry[]) => void;
}

export function RunButton({ isDisabled, onRun, onRunAll, onOpenMenu }: RunButtonProps) {
  return (
    <div className="run-button">
      <button disabled={isDisabled} onClick={onRun} title="Recognize the shown image or video frame (Ctrl+Enter)">
        Run <kbd>{RUN_SHORTCUT}</kbd>
      </button>
      <button
        className="run-more"
        disabled={isDisabled}
        aria-haspopup="menu"
        title="Recognize every picture lacking a result (Ctrl+Shift+Enter)"
        onClick={(event) =>
          onOpenMenu(event.currentTarget, [
            {
              label: <span title="Recognize every picture lacking a result (Ctrl+Shift+Enter)">Run All</span>,
              shortcut: "Ctrl+Shift+Enter",
              onSelect: onRunAll,
            },
          ])
        }
      >
        ▾
      </button>
    </div>
  );
}
