import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import {
  placeInViewport,
  type ViewportMargins,
  type ViewportPosition,
} from "../lib/viewportPlacement";

export interface ViewportAnchoring<Element extends HTMLElement> {
  element: RefObject<Element | null>;
  position: ViewportPosition;
}

/**
 * Positions a floating element at the given point, moved once it is measured so that it stays inside the window.
 */
export function useViewportPosition<Element extends HTMLElement>(
  left: number,
  top: number,
  margins: ViewportMargins,
): ViewportAnchoring<Element> {
  const element = useRef<Element>(null);
  const [position, setPosition] = useState<ViewportPosition>({ left, top });
  const { near, far } = margins;
  useLayoutEffect(() => {
    if (element.current === null) return;
    setPosition(
      placeInViewport(
        { left, top },
        element.current.getBoundingClientRect(),
        { near, far },
      ),
    );
  }, [left, top, near, far]);
  return { element, position };
}
