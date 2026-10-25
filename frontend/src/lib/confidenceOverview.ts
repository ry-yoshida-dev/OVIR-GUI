import type { Finding, ResultsPayload } from "../api/types";
import { ScoreHistogram, UNIT_RANGE, type ValueRange } from "./scoreHistogram";

export type ConfidenceMeasure = "confidence" | "similarity";

export interface PromptConfidences {
  prompt: string;
  histogram: ScoreHistogram;
  keptCount: number;
}

export interface ClassConfidences {
  className: string;
  histogram: ScoreHistogram;
  keptCount: number;
  prompts: PromptConfidences[];
}

interface Tally {
  scores: number[];
  keptCount: number;
}

const SIMILARITY_RANGE_STEP = 0.05;

export class ConfidenceOverview {
  readonly overall: ScoreHistogram;
  readonly overallKeptCount: number;
  readonly measuredCount: number;
  readonly classes: ClassConfidences[];

  private constructor(
    overall: ScoreHistogram,
    overallKeptCount: number,
    measuredCount: number,
    classes: ClassConfidences[],
  ) {
    this.overall = overall;
    this.overallKeptCount = overallKeptCount;
    this.measuredCount = measuredCount;
    this.classes = classes;
  }

  static of(
    payload: ResultsPayload | null,
    classPrompts: ReadonlyMap<string, readonly string[]>,
    measure: ConfidenceMeasure = "confidence",
  ): ConfidenceOverview {
    const classTallies = new Map<string, Tally>();
    const promptTallies = new Map<string, Map<string, Tally>>();
    for (const [className, prompts] of classPrompts) {
      classTallies.set(className, { scores: [], keptCount: 0 });
      promptTallies.set(
        className,
        new Map(
          prompts.map((prompt) => [prompt, { scores: [], keptCount: 0 }]),
        ),
      );
    }
    const allScores: number[] = [];
    let overallKeptCount = 0;
    for (const picture of payload?.pictures ?? []) {
      for (const finding of picture.findings) {
        const isKept = finding.is_accepted && finding.is_passing;
        const value = ConfidenceOverview.valueOf(finding, measure);
        if (value !== null) allScores.push(value);
        if (isKept) overallKeptCount += 1;
        const classTally = ConfidenceOverview.tallyIn(
          classTallies,
          finding.class_name,
        );
        if (value !== null) classTally.scores.push(value);
        if (isKept) classTally.keptCount += 1;
        if (finding.matched_prompt === null) continue;
        let prompts = promptTallies.get(finding.class_name);
        if (prompts === undefined) {
          prompts = new Map();
          promptTallies.set(finding.class_name, prompts);
        }
        const promptTally = ConfidenceOverview.tallyIn(prompts, finding.matched_prompt);
        if (value !== null) promptTally.scores.push(value);
        if (isKept) promptTally.keptCount += 1;
      }
    }
    const range =
      measure === "similarity"
        ? ConfidenceOverview.similarityRangeOf(allScores)
        : UNIT_RANGE;
    const classes = [...classTallies.entries()].map(([className, tally]) => ({
      className,
      histogram: ScoreHistogram.of(tally.scores, range),
      keptCount: tally.keptCount,
      prompts: [
        ...(promptTallies.get(className) ?? new Map<string, Tally>()).entries(),
      ].map(([prompt, promptTally]) => ({
        prompt,
        histogram: ScoreHistogram.of(promptTally.scores, range),
        keptCount: promptTally.keptCount,
      })),
    }));
    return new ConfidenceOverview(
      ScoreHistogram.of(allScores, range),
      overallKeptCount,
      allScores.length,
      classes,
    );
  }

  private static valueOf(
    finding: Finding,
    measure: ConfidenceMeasure,
  ): number | null {
    switch (measure) {
      case "confidence":
        return finding.confidence;
      case "similarity":
        return finding.similarity ?? null;
    }
  }

  private static similarityRangeOf(similarities: readonly number[]): ValueRange {
    if (similarities.length === 0) return UNIT_RANGE;
    const smallest = similarities.reduce((low, value) => Math.min(low, value));
    const largest = similarities.reduce((high, value) => Math.max(high, value));
    const lower =
      Math.floor(smallest / SIMILARITY_RANGE_STEP) * SIMILARITY_RANGE_STEP;
    const upper =
      Math.ceil(largest / SIMILARITY_RANGE_STEP) * SIMILARITY_RANGE_STEP;
    return {
      lower,
      upper: Math.max(upper, lower + SIMILARITY_RANGE_STEP),
    };
  }

  private static tallyIn(tallies: Map<string, Tally>, key: string): Tally {
    const existing = tallies.get(key);
    if (existing !== undefined) return existing;
    const created: Tally = { scores: [], keptCount: 0 };
    tallies.set(key, created);
    return created;
  }
}
