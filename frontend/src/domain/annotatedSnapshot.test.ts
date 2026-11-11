import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { annotatedSnapshot, copyAnnotatedSnapshot, type ShownPicture } from "@/domain/annotatedSnapshot";

/**
 * Browser pieces the snapshot uses, replaced by recording fakes because tests run in Node without a DOM.
 */
class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];

  constructor(attributes: Record<string, string> = {}) {
    for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }
}

class FakeGroup extends FakeElement {
  constructor(readonly descendants: FakeElement[]) {
    super();
  }

  cloneNode(): FakeGroup {
    return new FakeGroup(descendants(this.descendants));
  }

  querySelectorAll(selector: string): FakeElement[] {
    expect(selector).toBe('[vector-effect="non-scaling-stroke"]');
    return this.descendants.filter((element) => element.getAttribute("vector-effect") === "non-scaling-stroke");
  }
}

function descendants(elements: FakeElement[]): FakeElement[] {
  return elements.map((element) => new FakeElement(Object.fromEntries(element.attributes)));
}

class FakeImage {
  static failing = new Set<string>();
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  source = "";

  set src(value: string) {
    this.source = value;
    queueMicrotask(() => (FakeImage.failing.has(value) ? this.onerror?.() : this.onload?.()));
  }
}

class FakeSerializer {
  static serialized: FakeElement[] = [];

  serializeToString(root: FakeElement): string {
    FakeSerializer.serialized.push(root);
    return "<svg/>";
  }
}

interface DrawnImage {
  source: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

class FakeCanvas {
  width = 0;
  height = 0;
  readonly drawn: DrawnImage[] = [];
  hasContext = true;
  blob: Blob | null = new Blob(["png"], { type: "image/png" });

  getContext(kind: string): CanvasRenderingContext2D | null {
    expect(kind).toBe("2d");
    if (!this.hasContext) return null;
    const context = {
      drawImage: (image: FakeImage, x: number, y: number, width: number, height: number) =>
        this.drawn.push({ source: image.source, x, y, width, height }),
    };
    // Only drawImage is used by the snapshot, so a recording object stands in for the whole 2D context.
    return context as unknown as CanvasRenderingContext2D;
  }

  toBlob(callback: (blob: Blob | null) => void, type: string): void {
    expect(type).toBe("image/png");
    callback(this.blob);
  }
}

const OVERLAY_URL = "blob:overlay";

let canvas: FakeCanvas;
let overlay: FakeGroup;
let revoked: string[];

function picture(overrides: Partial<ShownPicture> = {}): ShownPicture {
  return {
    src: "/api/media/picture.png",
    // The fake group answers the calls the snapshot makes on an SVG group, which Node cannot create.
    overlay: overlay as unknown as SVGGElement,
    width: 640,
    height: 480,
    scale: 2,
    ...overrides,
  };
}

function serializedRoot(): FakeElement {
  const root = FakeSerializer.serialized[FakeSerializer.serialized.length - 1];
  if (root === undefined) throw new Error("Nothing was serialized");
  return root;
}

beforeEach(() => {
  canvas = new FakeCanvas();
  overlay = new FakeGroup([
    new FakeElement({ "vector-effect": "non-scaling-stroke", "stroke-width": "4", "stroke-dasharray": "6, 2 4" }),
    new FakeElement({ "vector-effect": "non-scaling-stroke" }),
    new FakeElement({ "stroke-width": "3" }),
  ]);
  revoked = [];
  FakeImage.failing = new Set();
  FakeSerializer.serialized = [];
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("XMLSerializer", FakeSerializer);
  vi.stubGlobal("document", {
    createElementNS: () => new FakeElement(),
    createElement: (tag: string) => {
      expect(tag).toBe("canvas");
      return canvas;
    },
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue(OVERLAY_URL);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url: string) => {
    revoked.push(url);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("annotatedSnapshot", () => {
  it("draws the picture and then the overlay at full size into a PNG", async () => {
    const blob = await annotatedSnapshot(picture());
    expect(blob.type).toBe("image/png");
    expect([canvas.width, canvas.height]).toEqual([640, 480]);
    expect(canvas.drawn).toEqual([
      { source: "/api/media/picture.png", x: 0, y: 0, width: 640, height: 480 },
      { source: OVERLAY_URL, x: 0, y: 0, width: 640, height: 480 },
    ]);
    expect(revoked).toEqual([OVERLAY_URL]);
  });

  it("sizes the overlay to the picture", async () => {
    await annotatedSnapshot(picture());
    const root = serializedRoot();
    expect(root.getAttribute("width")).toBe("640");
    expect(root.getAttribute("height")).toBe("480");
    expect(root.getAttribute("viewBox")).toBe("0 0 640 480");
  });

  it("keeps lines as thick as on screen by scaling strokes and dashes by the inverse zoom", async () => {
    await annotatedSnapshot(picture({ scale: 2 }));
    const copy = serializedRoot().children[0];
    if (!(copy instanceof FakeGroup)) throw new Error("The overlay copy was not attached");
    const [scaled, plain, fixed] = copy.descendants.map((element) => Object.fromEntries(element.attributes));
    expect(scaled).toEqual({ "stroke-width": "2", "stroke-dasharray": "3 1 2" });
    expect(plain).toEqual({});
    expect(fixed).toEqual({ "stroke-width": "3" });
  });

  it("leaves the overlay shown on screen untouched", async () => {
    await annotatedSnapshot(picture());
    expect(overlay.descendants[0]?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    expect(overlay.descendants[0]?.getAttribute("stroke-width")).toBe("4");
  });

  it("fails when the picture cannot be loaded and still releases the overlay", async () => {
    FakeImage.failing.add("/api/media/picture.png");
    await expect(annotatedSnapshot(picture())).rejects.toThrow("Cannot load /api/media/picture.png");
    expect(revoked).toEqual([OVERLAY_URL]);
  });

  it("fails without a 2D canvas", async () => {
    canvas.hasContext = false;
    await expect(annotatedSnapshot(picture())).rejects.toThrow("Canvas is not available");
    expect(revoked).toEqual([OVERLAY_URL]);
  });

  it("fails when the canvas cannot be encoded", async () => {
    canvas.blob = null;
    await expect(annotatedSnapshot(picture())).rejects.toThrow("Cannot encode the picture");
  });
});

describe("copyAnnotatedSnapshot", () => {
  it("explains that copying needs a secure page when the clipboard is unavailable", async () => {
    vi.stubGlobal("ClipboardItem", undefined);
    await expect(copyAnnotatedSnapshot(picture())).rejects.toThrow(
      "Copying pictures needs the page opened over https or localhost",
    );
  });

  it("puts the annotated picture on the clipboard as PNG", async () => {
    const written: Record<string, Promise<Blob>>[] = [];
    class FakeClipboardItem {
      constructor(readonly items: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    vi.stubGlobal("navigator", {
      clipboard: {
        write: async (items: FakeClipboardItem[]) => {
          for (const item of items) written.push(item.items);
        },
      },
    });
    await copyAnnotatedSnapshot(picture());
    expect(written).toHaveLength(1);
    const png = await written[0]?.["image/png"];
    expect(png?.type).toBe("image/png");
  });
});
