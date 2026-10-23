import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useDismiss } from "../hooks/useDismiss";
import { placeInViewport } from "../lib/viewportPlacement";

interface PopoverButtonProps {
  className: string;
  label: string;
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  isOpeningUpward?: boolean;
}

const POPOVER_MARGINS = { near: 8, far: 8 };
const ANCHOR_GAP = 4;

export function PopoverButton({ className, label, title, trigger, children, isOpeningUpward = false }: PopoverButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen || button.current === null || panel.current === null) return;
    const anchor = button.current.getBoundingClientRect();
    const bounds = panel.current.getBoundingClientRect();
    setPosition(
      placeInViewport(
        {
          left: anchor.right - bounds.width,
          top: isOpeningUpward ? anchor.top - bounds.height - ANCHOR_GAP : anchor.bottom + ANCHOR_GAP,
        },
        bounds,
        POPOVER_MARGINS,
      ),
    );
  }, [isOpen, isOpeningUpward]);
  useDismiss([panel, button], () => setIsOpen(false), { isActive: isOpen });

  return (
    <>
      <button
        ref={button}
        className={`${className}${isOpen ? " open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label}
        title={title}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        {trigger}
      </button>
      {isOpen && (
        <div ref={panel} className="popover settings-popover" role="dialog" aria-label={label} style={position}>
          {children}
        </div>
      )}
    </>
  );
}
