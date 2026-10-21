import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { InfoGlyph } from "./InfoGlyph";

interface InfoTipProps {
  label: string;
  children: ReactNode;
}

const EDGE_MARGIN = 8;
const ANCHOR_GAP = 6;

export function InfoTip({ label, children }: InfoTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen || button.current === null || bubble.current === null) return;
    const anchor = button.current.getBoundingClientRect();
    const bounds = bubble.current.getBoundingClientRect();
    const centeredLeft = anchor.left + anchor.width / 2 - bounds.width / 2;
    const below = anchor.bottom + ANCHOR_GAP;
    const isBelowFitting = below + bounds.height <= window.innerHeight - EDGE_MARGIN;
    setPosition({
      left: Math.max(EDGE_MARGIN, Math.min(centeredLeft, window.innerWidth - bounds.width - EDGE_MARGIN)),
      top: isBelowFitting ? below : Math.max(EDGE_MARGIN, anchor.top - ANCHOR_GAP - bounds.height),
    });
  }, [isOpen]);

  return (
    <>
      <button
        ref={button}
        className={`info-tip${isOpen ? " open" : ""}`}
        aria-label={label}
        aria-expanded={isOpen}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((wasOpen) => !wasOpen);
        }}
      >
        <InfoGlyph />
      </button>
      {isOpen && (
        <div ref={bubble} className="info-bubble" role="tooltip" style={position}>
          {children}
        </div>
      )}
    </>
  );
}
