import { type RefObject, useEffect, useState } from "react";

const NEAR_MARGIN = "300px";

/**
 * Turns true once the element comes near the visible part of its scroll container and stays true afterwards.
 */
export function useNearViewport(element: RefObject<Element | null>, isWatched: boolean): boolean {
  const [isNear, setIsNear] = useState(false);
  useEffect(() => {
    const target = element.current;
    if (!isWatched || isNear || target === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setIsNear(true);
      },
      { rootMargin: NEAR_MARGIN },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [element, isWatched, isNear]);
  return isNear;
}
