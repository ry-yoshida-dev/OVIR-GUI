import type {
  Box,
  DuplicateSuppression,
  Finding,
  FramePayload,
  ResultsPayload,
  Thresholds,
} from "../api/types";
import type { FrameResultIndex } from "./frameResultIndex";

export class ReviewFilter {
  private readonly thresholds: Thresholds;
  private readonly suppression: DuplicateSuppression;

  constructor(thresholds: Thresholds, suppression: DuplicateSuppression) {
    this.thresholds = thresholds;
    this.suppression = suppression;
  }

  static overlapOf(left: Box, right: Box): number {
    const width = Math.min(left[2], right[2]) - Math.max(left[0], right[0]);
    const height = Math.min(left[3], right[3]) - Math.max(left[1], right[1]);
    if (width <= 0 || height <= 0) return 0;
    const intersection = width * height;
    const leftArea = (left[2] - left[0]) * (left[3] - left[1]);
    const rightArea = (right[2] - right[0]) * (right[3] - right[1]);
    const union = leftArea + rightArea - intersection;
    return union <= 0 ? 0 : intersection / union;
  }

  minimumOf(className: string, matchedPrompt: string | null = null): number {
    const promptMinimum =
      matchedPrompt === null
        ? undefined
        : this.thresholds.prompt_minimums[className]?.[matchedPrompt];
    return (
      promptMinimum ??
      this.thresholds.class_minimums[className] ??
      this.thresholds.default_minimum
    );
  }

  overlapThresholdOf(className: string): number {
    return (
      this.suppression.class_overlap_thresholds[className] ??
      this.suppression.overlap_threshold
    );
  }

  isReaching(finding: Finding): boolean {
    return (
      finding.confidence >= this.minimumOf(finding.class_name, finding.matched_prompt)
    );
  }

  reaching<T extends Finding>(findings: readonly T[]): T[] {
    return findings.filter((finding) => this.isReaching(finding));
  }

  passingIndices(findings: readonly Finding[]): Set<number> {
    const reaching = this.reaching(findings);
    if (!this.suppression.is_enabled)
      return new Set(reaching.map((finding) => finding.index));
    const ordered = [...reaching].sort(
      (left, right) =>
        right.confidence - left.confidence || left.index - right.index,
    );
    const kept: { className: string; box: Box }[] = [];
    const passing = new Set<number>();
    for (const finding of ordered) {
      const box = finding.box;
      if (box === null) {
        passing.add(finding.index);
        continue;
      }
      const overlap = this.overlapThresholdOf(finding.class_name);
      const isDuplicate = kept.some(
        (candidate) =>
          candidate.className === finding.class_name &&
          ReviewFilter.overlapOf(candidate.box, box) > overlap,
      );
      if (isDuplicate) continue;
      kept.push({ className: finding.class_name, box });
      passing.add(finding.index);
    }
    return passing;
  }

  marked<T extends Finding>(findings: readonly T[]): T[] {
    const passing = this.passingIndices(findings);
    return findings.map((finding) => {
      const isPassing = passing.has(finding.index);
      return isPassing === finding.is_passing
        ? finding
        : { ...finding, is_passing: isPassing };
    });
  }

  markedFrame(frame: FramePayload): FramePayload {
    return { ...frame, findings: this.marked(frame.findings) };
  }

  markedResults(payload: ResultsPayload): ResultsPayload {
    return {
      ...payload,
      pictures: payload.pictures.map((picture) => ({
        ...picture,
        findings: this.marked(picture.findings),
      })),
    };
  }

  markedVideo(index: FrameResultIndex): FrameResultIndex {
    return index.mapped((frame) => this.markedFrame(frame));
  }
}
