import type { ReactNode } from "react";
import type { Box } from "../api/types";

export interface ViewerDrawing {
  color: string;
  onBox: (box: Box, isNegative: boolean) => void;
  onPoint: ((point: [number, number], isNegative: boolean) => void) | null;
  overlay: (scale: number) => ReactNode;
}
