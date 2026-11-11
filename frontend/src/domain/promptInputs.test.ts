import { describe, expect, it } from "vitest";
import {
  type PromptCapabilities,
  promptInputKindsOf,
  promptInputsAcross,
} from "@/domain/promptInputs";

function model(overrides: Partial<PromptCapabilities>): PromptCapabilities {
  return { prompt_mode: "classes", query_kinds: [], is_sequential: false, ...overrides };
}

describe("promptInputKindsOf", () => {
  it("accepts the query kinds of a class-prompted model", () => {
    expect(promptInputKindsOf(model({ query_kinds: ["text", "visual"] }))).toEqual(
      new Set(["text", "visual"]),
    );
  });

  it("accepts only everything for an automatic model, whatever its query kinds", () => {
    expect(
      promptInputKindsOf(model({ prompt_mode: "automatic", query_kinds: ["text", "mark"] })),
    ).toEqual(new Set(["everything"]));
  });

  it("adds video tracking for a sequential model", () => {
    expect(promptInputKindsOf(model({ prompt_mode: "marks", query_kinds: ["mark"], is_sequential: true }))).toEqual(
      new Set(["mark", "video"]),
    );
    expect(promptInputKindsOf(model({ prompt_mode: "automatic", is_sequential: true }))).toEqual(
      new Set(["everything", "video"]),
    );
  });

  it("accepts nothing for a class model without query kinds", () => {
    expect(promptInputKindsOf(model({}))).toEqual(new Set());
  });
});

describe("promptInputsAcross", () => {
  it("lists the inputs of all models once each, in the fixed order", () => {
    const inputs = promptInputsAcross([
      model({ query_kinds: ["mark", "text"], is_sequential: true }),
      model({ prompt_mode: "automatic" }),
      model({ query_kinds: ["exemplar", "text"] }),
    ]);
    expect(inputs.map((input) => input.kind)).toEqual(["everything", "text", "exemplar", "mark", "video"]);
  });

  it("gives every input a label and a hint", () => {
    const inputs = promptInputsAcross([
      model({ query_kinds: ["text", "visual", "exemplar", "mark"], is_sequential: true }),
      model({ prompt_mode: "automatic" }),
    ]);
    expect(inputs).toHaveLength(6);
    for (const input of inputs) {
      expect(input.label).not.toBe("");
      expect(input.hint).not.toBe("");
    }
  });

  it("returns no inputs for no models", () => {
    expect(promptInputsAcross([])).toEqual([]);
  });
});
