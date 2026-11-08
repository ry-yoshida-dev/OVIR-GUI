import type { ReactNode } from "react";
import type { Box } from "@/api/types";

/**
 * Content shown at a point of the picture, kept at the same screen size while zooming.
 */
export interface AnchoredContent {
  point: [number, number];
  content: ReactNode;
}

export interface ViewerDrawing {
  color: string;
  isDrawing: boolean;
  onBox: (box: Box, isInverted: boolean) => void;
  onPoint: ((point: [number, number], isInverted: boolean, scale: number) => void) | null;
  // Called on a click on the bare picture, to let the chosen drawing go.
  onEmptyClick: () => void;
  overlay: (scale: number) => ReactNode;
  hint: ReactNode | null;
  anchored: AnchoredContent | null;
}
