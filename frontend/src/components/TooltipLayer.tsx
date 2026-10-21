import { useEffect, useLayoutEffect, useRef, useState } from "react";

const SHOW_DELAY_MS = 250;
const WARM_PERIOD_MS = 600;
const VIEWPORT_MARGIN = 6;
const ANCHOR_GAP = 6;
const STORED_TITLE_ATTRIBUTE = "data-tooltip-title";

interface ShownTooltip {
  text: string;
  anchor: DOMRect;
}

interface TooltipPosition {
  left: number;
  top: number;
}

function anchorOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest(`[title], [${STORED_TITLE_ATTRIBUTE}]`);
  return anchor instanceof HTMLElement ? anchor : null;
}

function textOf(anchor: HTMLElement): string {
  const title = anchor.getAttribute("title");
  if (title !== null) {
    anchor.removeAttribute("title");
    anchor.setAttribute(STORED_TITLE_ATTRIBUTE, title);
    return title;
  }
  return anchor.getAttribute(STORED_TITLE_ATTRIBUTE) ?? "";
}

function restoreTitle(anchor: HTMLElement): void {
  const stored = anchor.getAttribute(STORED_TITLE_ATTRIBUTE);
  anchor.removeAttribute(STORED_TITLE_ATTRIBUTE);
  if (stored !== null && !anchor.hasAttribute("title")) anchor.setAttribute("title", stored);
}

/**
 * Replaces the native `title` tooltips of the whole page with one that appears quickly.
 *
 * While the pointer rests on an element with a `title`, the attribute is moved aside so the
 * browser's slow tooltip stays hidden, and it is put back when the pointer leaves.
 */
export function TooltipLayer() {
  const [shown, setShown] = useState<ShownTooltip | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const bubble = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current: HTMLElement | null = null;
    let showTimer: number | undefined;
    let lastHiddenAt = Number.NEGATIVE_INFINITY;
    let isVisible = false;

    const hide = (): void => {
      window.clearTimeout(showTimer);
      if (isVisible) lastHiddenAt = performance.now();
      isVisible = false;
      setShown(null);
    };

    const release = (): void => {
      if (current !== null) restoreTitle(current);
      current = null;
      hide();
    };

    const show = (anchor: HTMLElement): void => {
      if (!anchor.isConnected) return;
      const text = textOf(anchor);
      if (text.trim() === "") return;
      isVisible = true;
      setShown({ text, anchor: anchor.getBoundingClientRect() });
    };

    const onPointerOver = (event: PointerEvent): void => {
      if (event.pointerType === "touch") return;
      const anchor = anchorOf(event.target);
      if (anchor === current) {
        if (anchor !== null && anchor.hasAttribute("title")) textOf(anchor);
        return;
      }
      const wasVisible = isVisible;
      release();
      if (anchor === null) return;
      current = anchor;
      if (textOf(anchor).trim() === "") return;
      const isWarm = wasVisible || performance.now() - lastHiddenAt < WARM_PERIOD_MS;
      if (isWarm) show(anchor);
      else showTimer = window.setTimeout(() => show(anchor), SHOW_DELAY_MS);
    };

    const onPointerOut = (event: PointerEvent): void => {
      if (event.relatedTarget === null) release();
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", hide, true);
    document.addEventListener("wheel", hide, { capture: true, passive: true });
    document.addEventListener("scroll", hide, true);
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", hide, true);
      document.removeEventListener("wheel", hide, true);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", release);
      release();
    };
  }, []);

  useLayoutEffect(() => {
    if (shown === null || bubble.current === null) {
      setPosition(null);
      return;
    }
    const size = bubble.current.getBoundingClientRect();
    const { anchor } = shown;
    const centeredLeft = anchor.left + anchor.width / 2 - size.width / 2;
    const maxLeft = window.innerWidth - size.width - VIEWPORT_MARGIN;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(centeredLeft, maxLeft));
    const below = anchor.bottom + ANCHOR_GAP;
    const above = anchor.top - ANCHOR_GAP - size.height;
    const isRoomBelow = below + size.height <= window.innerHeight - VIEWPORT_MARGIN;
    const top = isRoomBelow || above < VIEWPORT_MARGIN ? below : above;
    setPosition({ left, top });
  }, [shown]);

  if (shown === null) return null;
  return (
    <div
      ref={bubble}
      className="tooltip"
      role="tooltip"
      style={position === null ? { visibility: "hidden" } : { left: position.left, top: position.top }}
    >
      {shown.text}
    </div>
  );
}
