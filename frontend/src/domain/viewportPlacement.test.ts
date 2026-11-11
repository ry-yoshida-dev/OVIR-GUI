import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeInViewport } from "@/domain/viewportPlacement";

const SIZE = { width: 200, height: 100 };
const MARGINS = { near: 8, far: 16 };

describe("placeInViewport", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { innerWidth: 800, innerHeight: 600 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a position that already fits", () => {
    expect(placeInViewport({ left: 100, top: 50 }, SIZE, MARGINS)).toEqual({ left: 100, top: 50 });
  });

  it("pulls an element past the bottom-right edge back by the far margin", () => {
    expect(placeInViewport({ left: 700, top: 550 }, SIZE, MARGINS)).toEqual({ left: 584, top: 484 });
  });

  it("pushes an element past the top-left edge in by the near margin", () => {
    expect(placeInViewport({ left: -50, top: 2 }, SIZE, MARGINS)).toEqual({ left: 8, top: 8 });
  });

  it("keeps the near margin when the window is smaller than the element", () => {
    vi.stubGlobal("window", { innerWidth: 150, innerHeight: 80 });
    expect(placeInViewport({ left: 40, top: 40 }, SIZE, MARGINS)).toEqual({ left: 8, top: 8 });
  });
});
