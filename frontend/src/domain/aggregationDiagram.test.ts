import { describe, expect, it } from "vitest";
import {
  colorNameOf,
  DIAGRAM_CLASSES,
  DIAGRAM_PROMPTS,
  type DiagramCell,
  groupsOf,
  isMergedCell,
  itemAt,
  LOGIT_SCALE,
  mergedVectors,
  probabilitiesOf,
  reducedSimilarities,
  sentenceCells,
} from "@/domain/aggregationDiagram";

const [dogPrompt, puppyPrompt, catPrompt] = DIAGRAM_PROMPTS;

/**
 * Cells of the dog prompt holding the given logits, one column each.
 */
function dogCells(logits: number[]): DiagramCell[] {
  const prompt = itemAt(DIAGRAM_PROMPTS, 0);
  return logits.map((logit, column) => ({
    klass: prompt.klass,
    prompts: [prompt],
    columns: [column],
    similarities: [logit / LOGIT_SCALE],
    logit,
  }));
}

function logitsOf(cells: DiagramCell[]): number[] {
  return cells.map((cell) => cell.logit);
}

describe("itemAt", () => {
  it("returns the item at the index", () => {
    expect(itemAt(["a", "b"], 1)).toBe("b");
  });

  it("throws for an index outside the list", () => {
    expect(() => itemAt(["a"], 1)).toThrow(RangeError);
    expect(() => itemAt([], 0)).toThrow(RangeError);
    expect(() => itemAt(["a"], -1)).toThrow(RangeError);
  });
});

describe("sentenceCells", () => {
  it("makes one cell per prompt and template, in prompt order", () => {
    const cells = sentenceCells();
    expect(cells).toHaveLength(6);
    expect(cells.map((cell) => [cell.prompts[0]?.text, cell.columns])).toEqual([
      ["dog", [0]],
      ["dog", [1]],
      ["puppy", [0]],
      ["puppy", [1]],
      ["cat", [0]],
      ["cat", [1]],
    ]);
  });

  it("scales each similarity into a logit", () => {
    const logits = logitsOf(sentenceCells());
    [31, 29, 30, 27, 28, 27].forEach((expected, index) => {
      expect(logits[index]).toBeCloseTo(expected);
    });
  });
});

describe("groupsOf", () => {
  const cells = sentenceCells();

  it("merges the templates of each prompt", () => {
    const groups = groupsOf(cells, "template");
    expect(groups.map((group) => group.map((cell) => cell.prompts[0]?.text))).toEqual([
      ["dog", "dog"],
      ["puppy", "puppy"],
      ["cat", "cat"],
    ]);
  });

  it("merges the prompts of each class and template", () => {
    const groups = groupsOf(cells, "prompt");
    expect(groups.map((group) => group.map((cell) => `${cell.prompts[0]?.text}${cell.columns[0]}`))).toEqual([
      ["dog0", "puppy0"],
      ["dog1", "puppy1"],
      ["cat0"],
      ["cat1"],
    ]);
  });

  it("merges every cell of a class for both units together", () => {
    const groups = groupsOf(cells, "template_and_prompt");
    expect(groups.map((group) => group.length)).toEqual([4, 2]);
  });

  it("returns no groups for no cells", () => {
    expect(groupsOf([], "template")).toEqual([]);
  });
});

describe("mergedVectors", () => {
  it("renormalizes the mean similarity of the merged sentence vectors", () => {
    const merged = mergedVectors(sentenceCells(), "template");
    expect(merged).toHaveLength(3);
    const dog = itemAt(merged, 0);
    expect(dog.prompts).toEqual([dogPrompt]);
    expect(dog.columns).toEqual([0, 1]);
    expect(dog.similarities).toEqual([0.31, 0.29]);
    expect(dog.logit).toBeCloseTo((0.3 / Math.sqrt(0.9)) * LOGIT_SCALE);
  });

  it("keeps the similarity of a group of one sentence", () => {
    const merged = mergedVectors(dogCells([25]), "template_and_prompt");
    expect(itemAt(merged, 0).logit).toBeCloseTo(25);
  });

  it("gathers the distinct prompts of a group merging prompts", () => {
    const dog0 = itemAt(mergedVectors(sentenceCells(), "prompt"), 0);
    expect(dog0.prompts).toEqual([dogPrompt, puppyPrompt]);
    expect(dog0.columns).toEqual([0]);
  });
});

describe("reducedSimilarities", () => {
  it.each([
    ["max", 5],
    ["min", 1],
    ["mean", 3],
    ["median", 3],
  ] as const)("reduces the logits by %s", (method, expected) => {
    const reduced = reducedSimilarities(dogCells([1, 5, 3]), "template_and_prompt", method);
    expect(reduced).toHaveLength(1);
    expect(itemAt(reduced, 0).logit).toBeCloseTo(expected);
  });

  it("takes the mean of the middle two logits as the median of an even count", () => {
    const reduced = reducedSimilarities(dogCells([4, 1, 10, 2]), "template_and_prompt", "median");
    expect(itemAt(reduced, 0).logit).toBeCloseTo(3);
  });

  it("reduces by logsumexp without overflowing", () => {
    const small = reducedSimilarities(dogCells([0, 0]), "template_and_prompt", "logsumexp");
    expect(itemAt(small, 0).logit).toBeCloseTo(Math.log(2));
    const large = reducedSimilarities(dogCells([1000, 1000]), "template_and_prompt", "logsumexp");
    expect(itemAt(large, 0).logit).toBeCloseTo(1000 + Math.log(2));
  });

  it("keeps every merged similarity and the prompts and columns of the group", () => {
    const reduced = reducedSimilarities(sentenceCells(), "prompt", "max");
    expect(reduced).toHaveLength(4);
    const dog0 = itemAt(reduced, 0);
    expect(dog0.prompts).toEqual([dogPrompt, puppyPrompt]);
    expect(dog0.columns).toEqual([0]);
    expect(dog0.similarities).toEqual([0.31, 0.3]);
    expect(dog0.logit).toBeCloseTo(31);
    expect(itemAt(reduced, 2).prompts).toEqual([catPrompt]);
  });

  it("reduces each class to one cell over two steps", () => {
    const byTemplate = reducedSimilarities(sentenceCells(), "template", "max");
    const byPrompt = reducedSimilarities(byTemplate, "prompt", "mean");
    expect(byPrompt.map((cell) => cell.klass)).toEqual(DIAGRAM_CLASSES);
    expect(itemAt(byPrompt, 0).logit).toBeCloseTo((31 + 30) / 2);
    expect(itemAt(byPrompt, 0).columns).toEqual([0, 1]);
    expect(itemAt(byPrompt, 1).logit).toBeCloseTo(28);
  });
});

describe("probabilitiesOf", () => {
  it("shares the score among the candidates by softmax", () => {
    const probabilities = probabilitiesOf(dogCells([0, Math.log(3)]), "softmax");
    expect(probabilities[0]).toBeCloseTo(0.25);
    expect(probabilities[1]).toBeCloseTo(0.75);
  });

  it("keeps softmax finite for large logits", () => {
    expect(probabilitiesOf(dogCells([1000, 1000]), "softmax")).toEqual([0.5, 0.5]);
  });

  it("scores each candidate on its own by sigmoid after the model bias", () => {
    const probabilities = probabilitiesOf(dogCells([29.5, 100, 0]), "sigmoid");
    expect(probabilities[0]).toBeCloseTo(0.5);
    expect(probabilities[1]).toBeCloseTo(1);
    expect(probabilities[2]).toBeLessThan(1e-12);
  });

  it("returns no scores for no candidates", () => {
    expect(probabilitiesOf([], "softmax")).toEqual([]);
    expect(probabilitiesOf([], "sigmoid")).toEqual([]);
  });
});

describe("isMergedCell", () => {
  it("is false for a single sentence", () => {
    expect(sentenceCells().some(isMergedCell)).toBe(false);
  });

  it("is true once templates or prompts are merged", () => {
    expect(mergedVectors(sentenceCells(), "template").map(isMergedCell)).toEqual([true, true, true]);
    expect(mergedVectors(sentenceCells(), "prompt").map(isMergedCell)).toEqual([true, true, false, false]);
  });
});

describe("colorNameOf", () => {
  it("uses the prompt of a cell with one prompt", () => {
    expect(colorNameOf(itemAt(sentenceCells(), 2))).toBe("puppy");
    expect(colorNameOf(itemAt(mergedVectors(sentenceCells(), "template"), 1))).toBe("puppy");
  });

  it("uses the class once prompts are merged", () => {
    expect(colorNameOf(itemAt(mergedVectors(sentenceCells(), "prompt"), 0))).toBe("dog");
  });
});
