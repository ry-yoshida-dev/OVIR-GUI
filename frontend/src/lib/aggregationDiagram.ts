import type { AggregationMethodValue, AggregationUnitValue, ScoreActivationValue } from "../api/types";

export interface DiagramClass {
  name: string;
  top: number;
  height: number;
  center: number;
}

export interface DiagramPrompt {
  text: string;
  subscript: string;
  klass: DiagramClass;
  top: number;
  similarities: number[];
}

/**
 * One text vector or similarity of the example classes: a cell of the table of prompts and templates of a class, or
 * a group of cells merged by aggregation steps.
 */
export interface DiagramCell {
  klass: DiagramClass;
  prompts: DiagramPrompt[];
  columns: number[];
  similarities: number[];
  logit: number;
}

const DOG: DiagramClass = { name: "dog", top: 82, height: 76, center: 120 };
const CAT: DiagramClass = { name: "cat", top: 212, height: 36, center: 230 };
export const DIAGRAM_CLASSES: DiagramClass[] = [DOG, CAT];
export const DIAGRAM_PROMPTS: DiagramPrompt[] = [
  { text: "dog", subscript: "₁", klass: DOG, top: 85, similarities: [0.31, 0.29] },
  { text: "puppy", subscript: "₂", klass: DOG, top: 125, similarities: [0.3, 0.27] },
  { text: "cat", subscript: "₃", klass: CAT, top: 215, similarities: [0.28, 0.27] },
];
export const DIAGRAM_TEMPLATES = ["a photo of a { }", "a drawing of a { }"];
export const LOGIT_SCALE = 100;
const SENTENCE_SIMILARITY = 0.8;
const SIGMOID_LOGIT_BIAS = -29.5;

/**
 * Item at a position of a list known to hold it.
 */
export function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`index ${index} is outside ${items.length} items`);
  return item;
}

/**
 * Every sentence of the example classes, one cell per prompt and template.
 */
export function sentenceCells(): DiagramCell[] {
  return DIAGRAM_PROMPTS.flatMap((prompt) =>
    prompt.similarities.map((similarity, column) => ({
      klass: prompt.klass,
      prompts: [prompt],
      columns: [column],
      similarities: [similarity],
      logit: similarity * LOGIT_SCALE,
    })),
  );
}

function keyOf(cell: DiagramCell, unit: AggregationUnitValue): string {
  switch (unit) {
    case "template":
      return `${cell.klass.name}|${cell.prompts.map((prompt) => prompt.text).join(",")}`;
    case "prompt":
      return `${cell.klass.name}|${cell.columns.join(",")}`;
    case "template_and_prompt":
      return cell.klass.name;
  }
}

/**
 * Cells one aggregation step merges, group by group in order of appearance.
 */
export function groupsOf(cells: readonly DiagramCell[], unit: AggregationUnitValue): DiagramCell[][] {
  const groups = new Map<string, DiagramCell[]>();
  for (const cell of cells) {
    const key = keyOf(cell, unit);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [cell]);
    else group.push(cell);
  }
  return [...groups.values()];
}

function mergedOf(group: readonly DiagramCell[], unit: AggregationUnitValue, logit: number): DiagramCell {
  const first = itemAt(group, 0);
  return {
    klass: first.klass,
    prompts: unit === "template" ? first.prompts : [...new Set(group.flatMap((cell) => cell.prompts))],
    columns: unit === "prompt" ? first.columns : [...new Set(group.flatMap((cell) => cell.columns))],
    similarities: group.flatMap((cell) => cell.similarities),
    logit,
  };
}

/**
 * Cosine similarity of the picture and the mean of normalized sentence vectors, renormalized, assuming every two
 * sentences have the same similarity.
 */
function representativeSimilarityOf(similarities: readonly number[]): number {
  const count = similarities.length;
  const mean = similarities.reduce((sum, value) => sum + value, 0) / count;
  return mean / Math.sqrt((1 + (count - 1) * SENTENCE_SIMILARITY) / count);
}

/**
 * Text vectors after one step on text vectors: every group becomes its representative vector.
 */
export function mergedVectors(cells: readonly DiagramCell[], unit: AggregationUnitValue): DiagramCell[] {
  return groupsOf(cells, unit).map((group) =>
    mergedOf(group, unit, representativeSimilarityOf(group.flatMap((cell) => cell.similarities)) * LOGIT_SCALE),
  );
}

function reduced(logits: readonly number[], method: AggregationMethodValue): number {
  const maximum = Math.max(...logits);
  switch (method) {
    case "max":
      return maximum;
    case "min":
      return Math.min(...logits);
    case "mean":
      return logits.reduce((sum, value) => sum + value, 0) / logits.length;
    case "median": {
      const sorted = [...logits].sort((left, right) => left - right);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 1
        ? itemAt(sorted, middle)
        : (itemAt(sorted, middle - 1) + itemAt(sorted, middle)) / 2;
    }
    case "logsumexp":
      return maximum + Math.log(logits.reduce((sum, value) => sum + Math.exp(value - maximum), 0));
  }
}

/**
 * Similarities after one step on similarities: the logits of every group become one.
 */
export function reducedSimilarities(
  cells: readonly DiagramCell[],
  unit: AggregationUnitValue,
  method: AggregationMethodValue,
): DiagramCell[] {
  return groupsOf(cells, unit).map((group) =>
    mergedOf(
      group,
      unit,
      reduced(
        group.map((cell) => cell.logit),
        method,
      ),
    ),
  );
}

/**
 * Score of every candidate: a softmax shares the score among the candidates, a sigmoid scores each on its own after
 * the bias of the example model.
 */
export function probabilitiesOf(cells: readonly DiagramCell[], activation: ScoreActivationValue): number[] {
  switch (activation) {
    case "softmax": {
      const maximum = Math.max(...cells.map((cell) => cell.logit));
      const exponentials = cells.map((cell) => Math.exp(cell.logit - maximum));
      const total = exponentials.reduce((sum, value) => sum + value, 0);
      return exponentials.map((value) => value / total);
    }
    case "sigmoid":
      return cells.map((cell) => 1 / (1 + Math.exp(-(cell.logit + SIGMOID_LOGIT_BIAS))));
  }
}

/**
 * Whether a cell stands for more than one sentence.
 */
export function isMergedCell(cell: DiagramCell): boolean {
  return cell.prompts.length > 1 || cell.columns.length > 1;
}

/**
 * Name of the color family of a cell: its prompt, or its class once its prompts are merged.
 */
export function colorNameOf(cell: DiagramCell): string {
  return cell.prompts.length > 1 ? cell.klass.name : itemAt(cell.prompts, 0).text;
}
