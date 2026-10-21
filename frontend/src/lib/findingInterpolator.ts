import type { Box, Finding, FrameInstance, FramePayload } from "../api/types";
import { isInstance } from "./frameView";

interface InstancePair {
  shown: FrameInstance;
  other: FrameInstance;
}

/**
 * Moves the findings of the nearer sampled frame toward their match on the other sampled frame, so boxes and masks
 * follow moving objects between sampled frames instead of jumping at each sample.
 */
export class FindingInterpolator {
  private static readonly MINIMUM_MATCH_SCORE = 0.05;

  /**
   * Findings of a frame lying between two sampled frames.
   *
   * @param before Sampled frame before ``frame``.
   * @param after Sampled frame after ``frame``.
   * @param frame Frame to draw.
   * @returns The nearer sampled frame with each matched instance moved to ``frame``; its indices are kept so that
   *   selection and filtering still address the nearer sampled frame.
   */
  static between(
    before: FramePayload,
    after: FramePayload,
    frame: number,
  ): FramePayload {
    const beforeFrame = before.frame ?? frame;
    const afterFrame = after.frame ?? frame;
    const span = afterFrame - beforeFrame;
    if (span <= 0) return before;
    const ratio = Math.min(1, Math.max(0, (frame - beforeFrame) / span));
    const isBeforeNearer = ratio <= 0.5;
    const shown = isBeforeNearer ? before : after;
    const other = isBeforeNearer ? after : before;
    const pairs = FindingInterpolator.pairsOf(shown.findings, other.findings);
    const findings = shown.findings.map((finding): Finding | FrameInstance => {
      if (!isInstance(finding)) return finding;
      const pair = pairs.get(finding.index);
      if (pair === undefined) return finding;
      const beforeBox = isBeforeNearer ? pair.shown.box : pair.other.box;
      const afterBox = isBeforeNearer ? pair.other.box : pair.shown.box;
      const box = FindingInterpolator.mix(beforeBox, afterBox, ratio);
      return {
        ...finding,
        box,
        polygons: FindingInterpolator.moved(finding.polygons, finding.box, box),
      };
    });
    return { ...shown, frame, is_exact: false, findings };
  }

  private static pairsOf(
    shownFindings: Finding[],
    otherFindings: Finding[],
  ): Map<number, InstancePair> {
    const shown = shownFindings.filter(isInstance);
    const other = otherFindings.filter(isInstance);
    const candidates: {
      shown: FrameInstance;
      other: FrameInstance;
      score: number;
    }[] = [];
    for (const shownInstance of shown) {
      for (const otherInstance of other) {
        if (shownInstance.class_name !== otherInstance.class_name) continue;
        const score = FindingInterpolator.matchScore(
          shownInstance.box,
          otherInstance.box,
        );
        if (score >= FindingInterpolator.MINIMUM_MATCH_SCORE)
          candidates.push({
            shown: shownInstance,
            other: otherInstance,
            score,
          });
      }
    }
    candidates.sort((left, right) => right.score - left.score);
    const pairs = new Map<number, InstancePair>();
    const usedOther = new Set<number>();
    for (const candidate of candidates) {
      if (
        pairs.has(candidate.shown.index) ||
        usedOther.has(candidate.other.index)
      )
        continue;
      pairs.set(candidate.shown.index, {
        shown: candidate.shown,
        other: candidate.other,
      });
      usedOther.add(candidate.other.index);
    }
    return pairs;
  }

  private static matchScore(first: Box, second: Box): number {
    const intersection =
      Math.max(
        0,
        Math.min(first[2], second[2]) - Math.max(first[0], second[0]),
      ) *
      Math.max(
        0,
        Math.min(first[3], second[3]) - Math.max(first[1], second[1]),
      );
    const union =
      FindingInterpolator.areaOf(first) +
      FindingInterpolator.areaOf(second) -
      intersection;
    if (intersection > 0 && union > 0) return 1 + intersection / union;
    const centerDistance = Math.hypot(
      (first[0] + first[2] - second[0] - second[2]) / 2,
      (first[1] + first[3] - second[1] - second[3]) / 2,
    );
    const reach = Math.max(
      first[2] - first[0],
      first[3] - first[1],
      second[2] - second[0],
      second[3] - second[1],
    );
    return reach <= 0 ? 0 : Math.max(0, 1 - centerDistance / reach);
  }

  private static areaOf(box: Box): number {
    return Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);
  }

  private static mix(from: Box, to: Box, ratio: number): Box {
    return [
      from[0] + (to[0] - from[0]) * ratio,
      from[1] + (to[1] - from[1]) * ratio,
      from[2] + (to[2] - from[2]) * ratio,
      from[3] + (to[3] - from[3]) * ratio,
    ];
  }

  private static moved(polygons: number[][], from: Box, to: Box): number[][] {
    if (polygons.length === 0) return polygons;
    const fromWidth = from[2] - from[0];
    const fromHeight = from[3] - from[1];
    const scaleX = fromWidth > 0 ? (to[2] - to[0]) / fromWidth : 1;
    const scaleY = fromHeight > 0 ? (to[3] - to[1]) / fromHeight : 1;
    return polygons.map((polygon) =>
      polygon.map((value, position) =>
        position % 2 === 0
          ? to[0] + (value - from[0]) * scaleX
          : to[1] + (value - from[1]) * scaleY,
      ),
    );
  }
}
