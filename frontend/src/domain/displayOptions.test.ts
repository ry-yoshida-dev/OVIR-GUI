import { describe, expect, it } from "vitest";
import { colorOf, DEFAULT_DISPLAY_OPTIONS, textColorOn } from "@/domain/displayOptions";

const FALLBACK = "#e6194b";

describe("colorOf", () => {
  const palette = ["#111111", "#222222", "#333333"];

  it("picks the palette color at the class id", () => {
    expect(colorOf(palette, 0)).toBe("#111111");
    expect(colorOf(palette, 2)).toBe("#333333");
  });

  it("wraps class ids past the end of the palette", () => {
    expect(colorOf(palette, 3)).toBe("#111111");
    expect(colorOf(palette, 7)).toBe("#222222");
  });

  it("falls back to the default red for an empty palette", () => {
    expect(colorOf([], 0)).toBe(FALLBACK);
    expect(colorOf([], 5)).toBe(FALLBACK);
  });
});

describe("textColorOn", () => {
  it.each([
    ["#ffffff", "#000000"],
    ["#ffff00", "#000000"],
    ["#00ff00", "#ffffff"],
    ["#000000", "#ffffff"],
    ["#0000ff", "#ffffff"],
    ["#808080", "#ffffff"],
    ["#c0c0c0", "#000000"],
  ])("puts %s text in %s", (background, text) => {
    expect(textColorOn(background)).toBe(text);
  });
});

describe("DEFAULT_DISPLAY_OPTIONS", () => {
  it("hides findings below the minimum by default", () => {
    expect(DEFAULT_DISPLAY_OPTIONS.belowMinimum).toBe("hide");
  });
});
