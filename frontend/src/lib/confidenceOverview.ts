import type { ResultsPayload } from "../api/types";
import { ScoreHistogram } from "./scoreHistogram";

export interface PhraseConfidences {
  phrase: string;
  histogram: ScoreHistogram;
  keptCount: number;
}

export interface ClassConfidences {
  className: string;
  histogram: ScoreHistogram;
  keptCount: number;
  phrases: PhraseConfidences[];
}

interface Tally {
  scores: number[];
  keptCount: number;
}

export class ConfidenceOverview {
  readonly overall: ScoreHistogram;
  readonly overallKeptCount: number;
  readonly classes: ClassConfidences[];

  private constructor(
    overall: ScoreHistogram,
    overallKeptCount: number,
    classes: ClassConfidences[],
  ) {
    this.overall = overall;
    this.overallKeptCount = overallKeptCount;
    this.classes = classes;
  }

  static of(
    payload: ResultsPayload | null,
    classPhrases: ReadonlyMap<string, readonly string[]>,
  ): ConfidenceOverview {
    const classTallies = new Map<string, Tally>();
    const phraseTallies = new Map<string, Map<string, Tally>>();
    for (const [className, phrases] of classPhrases) {
      classTallies.set(className, { scores: [], keptCount: 0 });
      phraseTallies.set(
        className,
        new Map(
          phrases.map((phrase) => [phrase, { scores: [], keptCount: 0 }]),
        ),
      );
    }
    const allScores: number[] = [];
    let overallKeptCount = 0;
    for (const picture of payload?.pictures ?? []) {
      for (const finding of picture.findings) {
        const isKept = finding.is_accepted && finding.is_passing;
        allScores.push(finding.confidence);
        if (isKept) overallKeptCount += 1;
        const classTally = ConfidenceOverview.tallyIn(
          classTallies,
          finding.class_name,
        );
        classTally.scores.push(finding.confidence);
        if (isKept) classTally.keptCount += 1;
        let phrases = phraseTallies.get(finding.class_name);
        if (phrases === undefined) {
          phrases = new Map();
          phraseTallies.set(finding.class_name, phrases);
        }
        const phraseTally = ConfidenceOverview.tallyIn(phrases, finding.query);
        phraseTally.scores.push(finding.confidence);
        if (isKept) phraseTally.keptCount += 1;
      }
    }
    const classes = [...classTallies.entries()].map(([className, tally]) => ({
      className,
      histogram: ScoreHistogram.of(tally.scores),
      keptCount: tally.keptCount,
      phrases: [
        ...(phraseTallies.get(className) ?? new Map<string, Tally>()).entries(),
      ].map(([phrase, phraseTally]) => ({
        phrase,
        histogram: ScoreHistogram.of(phraseTally.scores),
        keptCount: phraseTally.keptCount,
      })),
    }));
    return new ConfidenceOverview(
      ScoreHistogram.of(allScores),
      overallKeptCount,
      classes,
    );
  }

  private static tallyIn(tallies: Map<string, Tally>, key: string): Tally {
    const existing = tallies.get(key);
    if (existing !== undefined) return existing;
    const created: Tally = { scores: [], keptCount: 0 };
    tallies.set(key, created);
    return created;
  }
}
