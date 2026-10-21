import type { Finding, FrameInstance, FramePayload } from "../api/types";
import type { DisplayOptions } from "./displayOptions";

export const FALLBACK_CLASS_COLOR = "#e6194b";

export function isInstance(
  finding: Finding | FrameInstance,
): finding is FrameInstance {
  return "polygons" in finding && finding.box !== null;
}

export function labelOf(
  finding: Finding,
  options: DisplayOptions,
  prefix = "",
): string | undefined {
  if (!options.isLabelShown) return undefined;
  const confidence = options.isConfidenceShown
    ? ` ${finding.confidence.toFixed(2)}`
    : "";
  return `${prefix}${finding.class_name}${confidence}`;
}

export function visibleInstancesOf(
  frame: FramePayload,
  listedIndices: Set<number> | null,
  options: DisplayOptions,
): FrameInstance[] {
  return frame.findings
    .filter(isInstance)
    .filter(
      (finding) =>
        (listedIndices === null || listedIndices.has(finding.index)) &&
        (finding.is_accepted || options.isRejectedShown) &&
        (finding.is_passing || options.belowMinimum === "dim"),
    );
}

export function comparedOf(
  frame: FramePayload,
  options: DisplayOptions,
): FramePayload["compared"] {
  return options.isComparedShown ? frame.compared : null;
}
