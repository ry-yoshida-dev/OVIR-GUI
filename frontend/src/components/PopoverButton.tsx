import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

interface PopoverButtonProps {
  className: string;
  label: string;
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  isOpeningUpward?: boolean;
}

const EDGE_MARGIN = 8;

export function PopoverButton({ className, label, title, trigger, children, isOpeningUpward = false }: PopoverButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen || button.current === null || panel.current === null) return;
    const anchor = button.current.getBoundingClientRect();
    const bounds = panel.current.getBoundingClientRect();
    setPosition({
      left: Math.max(EDGE_MARGIN, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - EDGE_MARGIN)),
      top: Math.max(
        EDGE_MARGIN,
        Math.min(
          isOpeningUpward ? anchor.top - bounds.height - 4 : anchor.bottom + 4,
          window.innerHeight - bounds.height - EDGE_MARGIN,
        ),
      ),
    });
  }, [isOpen, isOpeningUpward]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen]);

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
