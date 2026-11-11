import { ContentFit, ViewportTransform } from "@video-player-ui/core";
import type { DrawingSurface, Point, Rect, Size, StrokeStyle, TextStyle } from "@video-player-ui/core";
import { describe, expect, it } from "vitest";
import type { Box, FrameInstance, FramePayload } from "@/api/types";
import { DEFAULT_DISPLAY_OPTIONS, type DisplayOptions } from "@/domain/displayOptions";
import { FindingPainter, type FrameScene } from "@/domain/findingPainter";

type SurfaceCall =
  | { kind: "save" }
  | { kind: "restore" }
  | { kind: "opacity"; factor: number }
  | { kind: "strokeRect"; rect: Rect; stroke: StrokeStyle }
  | { kind: "fillRect"; rect: Rect; color: string }
  | { kind: "strokePolyline"; points: readonly Point[]; stroke: StrokeStyle }
  | { kind: "fillPolygon"; points: readonly Point[]; color: string }
  | { kind: "fillText"; text: string; origin: Point; style: TextStyle };

/**
 * Drawing surface that records what is drawn; text is 6 units wide per character.
 */
class RecordingSurface implements DrawingSurface {
  readonly size: Size = { width: 100, height: 100 };
  readonly calls: SurfaceCall[] = [];

  clear(): void {}
  save(): void {
    this.calls.push({ kind: "save" });
  }
  restore(): void {
    this.calls.push({ kind: "restore" });
  }
  multiplyOpacity(factor: number): void {
    this.calls.push({ kind: "opacity", factor });
  }
  strokeRect(rect: Rect, stroke: StrokeStyle): void {
    this.calls.push({ kind: "strokeRect", rect, stroke });
  }
  fillRect(rect: Rect, color: string): void {
    this.calls.push({ kind: "fillRect", rect, color });
  }
  strokePolyline(points: readonly Point[], _isClosed: boolean, stroke: StrokeStyle): void {
    this.calls.push({ kind: "strokePolyline", points, stroke });
  }
  fillPolygon(points: readonly Point[], color: string): void {
    this.calls.push({ kind: "fillPolygon", points, color });
  }
  fillCircle(): void {}
  fillText(text: string, origin: Point, style: TextStyle): void {
    this.calls.push({ kind: "fillText", text, origin, style });
  }
  measureTextWidth(text: string): number {
    return text.length * 6;
  }

  callsOf<Kind extends SurfaceCall["kind"]>(kind: Kind): Extract<SurfaceCall, { kind: Kind }>[] {
    return this.calls.filter((call): call is Extract<SurfaceCall, { kind: Kind }> => call.kind === kind);
  }
}

const RED = "#ff0000";
const BLUE = "#0000ff";
const SQUARE: number[] = [10, 30, 30, 30, 30, 50, 10, 50];

/** Frame and view are both 100 by 100, so view coordinates equal frame pixels. */
const TRANSFORM = new ViewportTransform({ width: 100, height: 100 }, { width: 100, height: 100 }, ContentFit.FILL);

function instance(index: number, box: Box, overrides: Partial<FrameInstance> = {}): FrameInstance {
  return {
    index,
    class_name: "person",
    matched_prompt: null,
    matched_template: null,
    confidence: 0.9,
    box,
    area: null,
    is_accepted: true,
    is_passing: true,
    polygons: [],
    ...overrides,
  };
}

function scene(findings: FrameInstance[], overrides: Partial<FrameScene> = {}, compared: FramePayload["compared"] = null): FrameScene {
  return {
    frame: {
      path: "/pictures/a.png",
      frame: null,
      task: "segmentation",
      result_frame: null,
      is_recognized: true,
      is_exact: true,
      outdated: null,
      findings,
      scores: [],
      compared,
    },
    listedIndices: null,
    highlightedIndex: null,
    ...overrides,
  };
}

function painter(overrides: Partial<DisplayOptions> = {}): FindingPainter {
  return new FindingPainter(100, 100, { ...DEFAULT_DISPLAY_OPTIONS, ...overrides }, { person: RED, car: BLUE });
}

function drawn(options: Partial<DisplayOptions>, frameScene: FrameScene): RecordingSurface {
  const surface = new RecordingSurface();
  painter(options).draw(surface, TRANSFORM, frameScene);
  return surface;
}

describe("FindingPainter.draw", () => {
  it("outlines a box in its class color with a label above it", () => {
    const surface = drawn({}, scene([instance(0, [10, 30, 50, 70])]));
    expect(surface.callsOf("strokeRect")).toEqual([
      { kind: "strokeRect", rect: { x: 10, y: 30, width: 40, height: 40 }, stroke: { color: RED, width: 2 } },
    ]);
    expect(surface.callsOf("fillRect")).toEqual([
      { kind: "fillRect", rect: { x: 10, y: 12, width: 6 * "person 0.90".length + 6, height: 18 }, color: RED },
    ]);
    const [text] = surface.callsOf("fillText");
    expect(text?.text).toBe("person 0.90");
    expect(text?.origin).toEqual({ x: 13, y: 15 });
    expect(text?.style.color).toBe("#ffffff");
  });

  it("puts the label inside a box touching the top edge", () => {
    const surface = drawn({ isConfidenceShown: false }, scene([instance(0, [10, 5, 50, 70])]));
    expect(surface.callsOf("fillRect")[0]?.rect.y).toBe(5);
  });

  it("writes dark text on a light class color", () => {
    const surface = new RecordingSurface();
    new FindingPainter(100, 100, DEFAULT_DISPLAY_OPTIONS, { person: "#ffff00" }).draw(
      surface,
      TRANSFORM,
      scene([instance(0, [10, 30, 50, 70])]),
    );
    expect(surface.callsOf("fillText")[0]?.style.color).toBe("#000000");
  });

  it("draws no label when labels are hidden", () => {
    const surface = drawn({ isLabelShown: false }, scene([instance(0, [10, 30, 50, 70])]));
    expect(surface.callsOf("fillText")).toEqual([]);
    expect(surface.callsOf("fillRect")).toEqual([]);
  });

  it("prefers the instance's own color, then the fallback color for an unknown class", () => {
    const surface = drawn(
      { isLabelShown: false },
      scene([instance(0, [0, 0, 10, 10], { color: "#00ff00" }), instance(1, [0, 0, 10, 10], { class_name: "dog" })]),
    );
    expect(surface.callsOf("strokeRect").map((call) => call.stroke.color)).toEqual(["#00ff00", "#e6194b"]);
  });

  it("fades rejected and below-minimum instances", () => {
    const surface = drawn(
      { belowMinimum: "dim" },
      scene([instance(0, [0, 0, 10, 10], { is_accepted: false, is_passing: false })]),
    );
    expect(surface.callsOf("opacity").map((call) => call.factor)).toEqual([0.55, 0.3]);
    expect(surface.calls[0]).toEqual({ kind: "save" });
    expect(surface.calls[surface.calls.length - 1]).toEqual({ kind: "restore" });
  });

  it("fills a box faintly when boxes are filled", () => {
    const surface = drawn({ isFilled: true, isLabelShown: false }, scene([instance(0, [10, 30, 50, 70])]));
    expect(surface.callsOf("fillRect")).toEqual([
      { kind: "fillRect", rect: { x: 10, y: 30, width: 40, height: 40 }, color: "rgba(255, 0, 0, 0.18)" },
    ]);
  });

  it("draws a mask filled and outlined in its class color without its box", () => {
    const surface = drawn({ isLabelShown: false }, scene([instance(0, [10, 30, 30, 50], { polygons: [SQUARE] })]));
    const points = [
      { x: 10, y: 30 },
      { x: 30, y: 30 },
      { x: 30, y: 50 },
      { x: 10, y: 50 },
    ];
    expect(surface.callsOf("fillPolygon")).toEqual([{ kind: "fillPolygon", points, color: "rgba(255, 0, 0, 0.45)" }]);
    expect(surface.callsOf("strokePolyline")).toEqual([{ kind: "strokePolyline", points, stroke: { color: RED, width: 1 } }]);
    expect(surface.callsOf("strokeRect")).toEqual([]);
  });

  it("outlines the box of a mask when mask boxes are shown", () => {
    const surface = drawn(
      { isLabelShown: false, isMaskBoxShown: true },
      scene([instance(0, [10, 30, 30, 50], { polygons: [SQUARE] })]),
    );
    expect(surface.callsOf("strokeRect")).toHaveLength(1);
  });

  it("skips mask parts with fewer than three points", () => {
    const surface = drawn({ isLabelShown: false }, scene([instance(0, [10, 30, 30, 50], { polygons: [[10, 30, 30, 30], SQUARE] })]));
    expect(surface.callsOf("fillPolygon")).toHaveLength(1);
  });

  it("draws a mask as a box when masks are hidden", () => {
    const surface = drawn(
      { isLabelShown: false, isMaskShown: false },
      scene([instance(0, [10, 30, 30, 50], { polygons: [SQUARE] })]),
    );
    expect(surface.callsOf("fillPolygon")).toEqual([]);
    expect(surface.callsOf("strokeRect")).toHaveLength(1);
  });

  it("draws the highlighted box last with a white rim and a tinted fill", () => {
    const surface = drawn(
      { isLabelShown: false },
      scene([instance(0, [0, 0, 10, 10]), instance(1, [20, 20, 40, 40], { class_name: "car" })], { highlightedIndex: 0 }),
    );
    expect(surface.callsOf("strokeRect").map((call) => call.stroke)).toEqual([
      { color: BLUE, width: 2 },
      { color: "#ffffff", width: 7 },
      { color: RED, width: 4 },
    ]);
    expect(surface.callsOf("fillRect").map((call) => call.color)).toEqual(["rgba(255, 0, 0, 0.22)"]);
  });

  it("draws the highlighted mask with a white rim, a stronger fill and its box", () => {
    const surface = drawn(
      { isLabelShown: false, maskOpacity: 0.7 },
      scene([instance(0, [10, 30, 30, 50], { polygons: [SQUARE] })], { highlightedIndex: 0 }),
    );
    expect(surface.callsOf("strokePolyline").map((call) => call.stroke)).toEqual([
      { color: "#ffffff", width: 4 },
      { color: RED, width: 2 },
    ]);
    expect(surface.callsOf("fillPolygon")[0]?.color).toBe("rgba(255, 0, 0, 0.85)");
    expect(surface.callsOf("strokeRect").map((call) => call.stroke)).toEqual([{ color: RED, width: 2 }]);
  });

  it("draws only the listed instances", () => {
    const surface = drawn(
      { isLabelShown: false },
      scene([instance(0, [0, 0, 10, 10]), instance(1, [20, 20, 40, 40])], { listedIndices: new Set([1]) }),
    );
    expect(surface.callsOf("strokeRect").map((call) => call.rect.x)).toEqual([20]);
  });

  it("draws the compared result faded, outlined in white and labeled with its model", () => {
    const compared = {
      model_name: "base",
      findings: [instance(0, [10, 30, 30, 50], { class_name: "car", polygons: [SQUARE] })],
      top_class: null,
    };
    const surface = drawn({}, scene([], {}, compared));
    expect(surface.callsOf("opacity").map((call) => call.factor)).toEqual([0.75]);
    expect(surface.callsOf("strokePolyline").map((call) => call.stroke)).toEqual([{ color: BLUE, width: 1 }]);
    expect(surface.callsOf("strokeRect").map((call) => call.stroke)).toEqual([
      { color: "#ffffff", width: 3 },
      { color: BLUE, width: 1 },
    ]);
    expect(surface.callsOf("fillText")[0]?.text).toBe("base: car 0.90");
  });

  it("leaves out the compared result when it is hidden", () => {
    const compared = { model_name: "base", findings: [instance(0, [10, 30, 30, 50])], top_class: null };
    expect(drawn({ isComparedShown: false }, scene([], {}, compared)).calls).toEqual([]);
  });
});

describe("FindingPainter.findingAt", () => {
  it("finds the box under a point given in frame fractions", () => {
    const frameScene = scene([instance(4, [10, 10, 50, 50])]);
    expect(painter().findingAt({ x: 0.3, y: 0.3 }, frameScene)).toBe(4);
    expect(painter().findingAt({ x: 0.1, y: 0.5 }, frameScene)).toBe(4);
    expect(painter().findingAt({ x: 0.6, y: 0.3 }, frameScene)).toBeNull();
  });

  it("picks the smallest of overlapping boxes", () => {
    const frameScene = scene([instance(0, [0, 0, 100, 100]), instance(1, [20, 20, 40, 40]), instance(2, [10, 10, 60, 60])]);
    expect(painter().findingAt({ x: 0.3, y: 0.3 }, frameScene)).toBe(1);
  });

  it("finds a mask only inside its outline", () => {
    const triangle = [0, 0, 100, 0, 0, 100];
    const frameScene = scene([instance(0, [0, 0, 100, 100], { polygons: [triangle] })]);
    expect(painter().findingAt({ x: 0.2, y: 0.2 }, frameScene)).toBe(0);
    expect(painter().findingAt({ x: 0.8, y: 0.8 }, frameScene)).toBeNull();
  });

  it("uses the box of a mask when masks are hidden", () => {
    const triangle = [0, 0, 100, 0, 0, 100];
    const frameScene = scene([instance(0, [0, 0, 100, 100], { polygons: [triangle] })]);
    expect(painter({ isMaskShown: false }).findingAt({ x: 0.8, y: 0.8 }, frameScene)).toBe(0);
  });

  it("ignores instances that are not shown", () => {
    const frameScene = scene([instance(0, [0, 0, 100, 100]), instance(1, [0, 0, 50, 50], { is_passing: false })], {
      listedIndices: new Set([1]),
    });
    expect(painter().findingAt({ x: 0.2, y: 0.2 }, frameScene)).toBeNull();
  });
});
