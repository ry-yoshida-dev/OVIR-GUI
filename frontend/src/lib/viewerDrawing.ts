import type { ReactNode } from "react";
import type { Box } from "../api/types";

export interface ViewerDrawing {
  color: string;
  onBox: (box: Box, isInverted: boolean) => void;
  onPoint: ((point: [number, number], isInverted: boolean) => void) | null;
  overlay: (scale: number) => ReactNode;
}
