import { type ReactNode, useState } from "react";
import { useDismiss } from "../hooks/useDismiss";
import { useViewportPosition } from "../hooks/useViewportPosition";

export interface MenuEntry {
  label: ReactNode;
  onSelect?: () => void;
  isDisabled?: boolean;
  isChecked?: boolean;
  shortcut?: string;
  isSeparator?: boolean;
  control?: ReactNode;
}

interface MenuProps {
  x: number;
  y: number;
  entries: MenuEntry[];
  onClose: () => void;
}

const MENU_MARGINS = { near: 4, far: 4 };

export function Menu({ x, y, entries, onClose }: MenuProps) {
  const { element: reference, position } = useViewportPosition<HTMLDivElement>(x, y, MENU_MARGINS);
  useDismiss([reference], onClose, { isDismissedOnBlur: true });

  return (
    <div className="menu" ref={reference} style={position} onContextMenu={(event) => event.preventDefault()}>
      {entries.map((entry, index) =>
        entry.isSeparator ? (
          <div key={index} className="menu-separator" />
        ) : entry.control !== undefined ? (
          <div key={index} className="menu-item menu-control">
            <span style={{ width: 12 }} />
            <span>{entry.label}</span>
            <span className="menu-control-slot">{entry.control}</span>
          </div>
        ) : (
          <div
            key={index}
            className={`menu-item${entry.isDisabled ? " disabled" : ""}`}
            onClick={() => {
              onClose();
              entry.onSelect?.();
            }}
          >
            <span style={{ width: 12 }}>{entry.isChecked ? "✓" : ""}</span>
            <span>{entry.label}</span>
            {entry.shortcut !== undefined && <span className="shortcut">{entry.shortcut}</span>}
          </div>
        ),
      )}
    </div>
  );
}

export function useMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);
  const element =
    menu === null ? null : <Menu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />;
  const open = (x: number, y: number, entries: MenuEntry[]) => setMenu({ x, y, entries });
  const openBelow = (target: HTMLElement, entries: MenuEntry[]) => {
    const bounds = target.getBoundingClientRect();
    setMenu({ x: bounds.left, y: bounds.bottom + 2, entries });
  };
  return { element, open, openBelow };
}
