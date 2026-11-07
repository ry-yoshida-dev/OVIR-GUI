import { type PointerEvent, useRef, useState } from "react";

interface PointerDragOptions<Target extends Element> {
  canStart?: (event: PointerEvent<Target>) => boolean;
  onDrag: (event: PointerEvent<Target>) => void;
  onDrop?: (event: PointerEvent<Target>) => void;
}

export interface PointerDrag<Target extends Element> {
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<Target>) => void;
  onPointerMove: (event: PointerEvent<Target>) => void;
  onPointerUp: (event: PointerEvent<Target>) => void;
  onPointerCancel: (event: PointerEvent<Target>) => void;
}

/**
 * Tracks a drag that captures the pointer on press, reporting the press and every move while pressed to onDrag and
 * the release to onDrop.
 */
export function usePointerDrag<Target extends Element>({
  canStart,
  onDrag,
  onDrop,
}: PointerDragOptions<Target>): PointerDrag<Target> {
  const isPressed = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const stop = (event: PointerEvent<Target>) => {
    if (!isPressed.current) return;
    isPressed.current = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    onDrop?.(event);
  };
  return {
    isDragging,
    onPointerDown: (event) => {
      if (canStart !== undefined && !canStart(event)) return;
      isPressed.current = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      onDrag(event);
    },
    onPointerMove: (event) => {
      if (isPressed.current) onDrag(event);
    },
    onPointerUp: stop,
    onPointerCancel: stop,
  };
}
