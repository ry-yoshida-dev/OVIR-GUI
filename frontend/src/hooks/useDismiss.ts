import { type RefObject, useEffect, useEffectEvent } from "react";

interface DismissOptions {
  isActive?: boolean;
  isDismissedOnBlur?: boolean;
}

/**
 * Calls onDismiss when the pointer goes down outside every given element, when Escape is pressed and, optionally,
 * when the window loses focus.
 */
export function useDismiss(
  elements: readonly RefObject<HTMLElement | null>[],
  onDismiss: () => void,
  { isActive = true, isDismissedOnBlur = false }: DismissOptions = {},
): void {
  const isOutside = useEffectEvent((target: Node) =>
    elements.every((element) => !element.current?.contains(target)),
  );
  const dismiss = useEffectEvent(() => onDismiss());

  useEffect(() => {
    if (!isActive) return;
    const onPointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && isOutside(event.target)) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    const onBlur = () => dismiss();
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    if (isDismissedOnBlur) window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [isActive, isDismissedOnBlur]);
}
