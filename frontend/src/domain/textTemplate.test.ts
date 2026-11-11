import { describe, expect, it } from "vitest";
import {
  filledWith,
  PLAIN_TEMPLATE,
  templateLabelOf,
  templateOf,
  wordsOf,
} from "@/domain/textTemplate";

describe("wordsOf", () => {
  it("splits the words around the slot", () => {
    expect(wordsOf("a photo of a {} in the wild")).toEqual({ before: "a photo of a", after: "in the wild" });
  });

  it("keeps punctuation attached after the slot", () => {
    expect(wordsOf("a photo of a {}.")).toEqual({ before: "a photo of a", after: "." });
  });

  it("returns no words for the plain template", () => {
    expect(wordsOf(PLAIN_TEMPLATE)).toEqual({ before: "", after: "" });
  });

  it("puts all words before when there is no slot", () => {
    expect(wordsOf("  just words ")).toEqual({ before: "just words", after: "" });
  });

  it("returns no words for an empty template", () => {
    expect(wordsOf("")).toEqual({ before: "", after: "" });
  });

  it("unescapes literal braces and does not take them for the slot", () => {
    expect(wordsOf("{{tag}} {}")).toEqual({ before: "{tag}", after: "" });
    expect(wordsOf("{{}}")).toEqual({ before: "{}", after: "" });
  });

  it("finds the slot right after an escaped brace", () => {
    expect(wordsOf("{{{}}}")).toEqual({ before: "{", after: "}" });
  });
});

describe("templateOf", () => {
  it("spaces the words around the slot like a sentence", () => {
    expect(templateOf({ before: "a photo of a", after: "in the wild" })).toBe("a photo of a {} in the wild");
  });

  it("attaches punctuation directly after the slot", () => {
    expect(templateOf({ before: "a photo of a", after: "." })).toBe("a photo of a {}.");
    expect(templateOf({ before: "", after: ", indoors" })).toBe("{}, indoors");
    expect(templateOf({ before: "(", after: ")" })).toBe("( {})");
  });

  it("trims the words", () => {
    expect(templateOf({ before: "  a  ", after: "  b  " })).toBe("a {} b");
  });

  it("writes only one side when the other is empty", () => {
    expect(templateOf({ before: "a photo of a", after: "" })).toBe("a photo of a {}");
    expect(templateOf({ before: "", after: "outdoors" })).toBe("{} outdoors");
  });

  it("returns null when there are no words", () => {
    expect(templateOf({ before: "", after: "" })).toBeNull();
    expect(templateOf({ before: "   ", after: "\t" })).toBeNull();
  });

  it("escapes literal braces", () => {
    expect(templateOf({ before: "{tag}", after: "{y}" })).toBe("{{tag}} {} {{y}}");
  });

  it.each([
    { before: "a photo of a", after: "." },
    { before: "{x}", after: "in {y}" },
    { before: "", after: "outdoors" },
  ])("round-trips through wordsOf: %o", (words) => {
    const template = templateOf(words);
    expect(template).not.toBeNull();
    expect(wordsOf(template ?? "")).toEqual(words);
  });
});

describe("templateLabelOf", () => {
  it("reads the plain template as None", () => {
    expect(templateLabelOf(PLAIN_TEMPLATE)).toBe("None");
  });

  it("marks where the prompt goes", () => {
    expect(templateLabelOf("a photo of a {}.")).toBe("a photo of a {prompt}.");
  });

  it("unescapes literal braces", () => {
    expect(templateLabelOf("{{x}} {}")).toBe("{x} {prompt}");
  });
});

describe("filledWith", () => {
  it("puts the prompt into the slot", () => {
    expect(filledWith("a photo of a {}.", "dog")).toBe("a photo of a dog.");
  });

  it("returns the prompt as written for the plain template", () => {
    expect(filledWith(PLAIN_TEMPLATE, "dog")).toBe("dog");
  });

  it("unescapes literal braces around the prompt", () => {
    expect(filledWith("{{x}} {} {{y}}", "dog")).toBe("{x} dog {y}");
  });

  it("does not unescape braces inside the prompt", () => {
    expect(filledWith("a {}", "{{z}}")).toBe("a {{z}}");
  });

  it("fills only the first slot", () => {
    expect(filledWith("{} and {}", "dog")).toBe("dog and {}");
  });
});
