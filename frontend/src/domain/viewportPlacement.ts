export interface ViewportPosition {
  left: number;
  top: number;
}

export interface ViewportMargins {
  near: number;
  far: number;
}

/**
 * Moves a floating element of the given size so that it stays inside the window, keeping the near margin from the
 * top-left edges and the far margin from the bottom-right edges; the near margin wins on a small window.
 */
export function placeInViewport(
  desired: ViewportPosition,
  size: { width: number; height: number },
  margins: ViewportMargins,
): ViewportPosition {
  return {
    left: Math.max(
      margins.near,
      Math.min(desired.left, window.innerWidth - size.width - margins.far),
    ),
    top: Math.max(
      margins.near,
      Math.min(desired.top, window.innerHeight - size.height - margins.far),
    ),
  };
}
