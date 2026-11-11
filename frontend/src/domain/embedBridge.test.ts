import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ObjectDocument } from "@/api/types";
import {
  EMBED_PROTOCOL_VERSION,
  EmbedBridge,
  type EmbedHandlers,
  parseEmbedRequest,
} from "@/domain/embedBridge";

describe("parseEmbedRequest", () => {
  describe("open", () => {
    it("accepts paths with a shown path", () => {
      expect(parseEmbedRequest({ type: "ovir-gui:open", paths: ["/a.png", "/b.mp4"], show: "/b.mp4" })).toEqual({
        type: "ovir-gui:open",
        paths: ["/a.png", "/b.mp4"],
        show: "/b.mp4",
      });
    });

    it("reads a missing or null shown path as none", () => {
      expect(parseEmbedRequest({ type: "ovir-gui:open", paths: ["/a.png"] })).toEqual({
        type: "ovir-gui:open",
        paths: ["/a.png"],
        show: null,
      });
      expect(parseEmbedRequest({ type: "ovir-gui:open", paths: ["/a.png"], show: null })).toEqual({
        type: "ovir-gui:open",
        paths: ["/a.png"],
        show: null,
      });
    });

    it.each([
      [{ type: "ovir-gui:open" }],
      [{ type: "ovir-gui:open", paths: [] }],
      [{ type: "ovir-gui:open", paths: "/a.png" }],
      [{ type: "ovir-gui:open", paths: ["/a.png", 3] }],
      [{ type: "ovir-gui:open", paths: null }],
    ])("rejects missing, empty or non-string paths: %o", (data) => {
      expect(parseEmbedRequest(data)).toBe("open needs paths: a non-empty list of server paths");
    });

    it.each([[3], [["/a.png"]], [{}], [false]])("rejects a shown path that is not a string: %o", (show) => {
      expect(parseEmbedRequest({ type: "ovir-gui:open", paths: ["/a.png"], show })).toBe("show must be a path");
    });
  });

  describe("show", () => {
    it("accepts a path with a frame", () => {
      expect(parseEmbedRequest({ type: "ovir-gui:show", path: "/v.mp4", frame: 12 })).toEqual({
        type: "ovir-gui:show",
        path: "/v.mp4",
        frame: 12,
      });
    });

    it("accepts frame zero and reads a missing or null frame as none", () => {
      expect(parseEmbedRequest({ type: "ovir-gui:show", path: "/v.mp4", frame: 0 })).toEqual({
        type: "ovir-gui:show",
        path: "/v.mp4",
        frame: 0,
      });
      expect(parseEmbedRequest({ type: "ovir-gui:show", path: "/a.png" })).toEqual({
        type: "ovir-gui:show",
        path: "/a.png",
        frame: null,
      });
      expect(parseEmbedRequest({ type: "ovir-gui:show", path: "/a.png", frame: null })).toEqual({
        type: "ovir-gui:show",
        path: "/a.png",
        frame: null,
      });
    });

    it.each([[undefined], [null], [5], [["/a.png"]]])("rejects a path that is not a string: %o", (path) => {
      expect(parseEmbedRequest({ type: "ovir-gui:show", path })).toBe("show needs a path");
    });

    it.each([[-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], ["3"], [true]])(
      "rejects a frame that is not a non-negative integer: %o",
      (frame) => {
        expect(parseEmbedRequest({ type: "ovir-gui:show", path: "/v.mp4", frame })).toBe(
          "frame must be a non-negative integer",
        );
      },
    );
  });

  describe("close", () => {
    it("accepts a list of paths, including an empty one", () => {
      expect(parseEmbedRequest({ type: "ovir-gui:close", paths: ["/a.png"] })).toEqual({
        type: "ovir-gui:close",
        paths: ["/a.png"],
      });
      expect(parseEmbedRequest({ type: "ovir-gui:close", paths: [] })).toEqual({ type: "ovir-gui:close", paths: [] });
    });

    it.each([[undefined], [null], ["/a.png"], [[1]], [{ 0: "/a.png" }]])("rejects paths that are not a list of strings: %o", (paths) => {
      expect(parseEmbedRequest({ type: "ovir-gui:close", paths })).toBe("close needs paths: a list of server paths");
    });
  });

  describe("get-results", () => {
    it("accepts a list of paths", () => {
      expect(parseEmbedRequest({ type: "ovir-gui:get-results", paths: ["/a.png"] })).toEqual({
        type: "ovir-gui:get-results",
        paths: ["/a.png"],
      });
    });

    it("reads missing or null paths as every picture", () => {
      expect(parseEmbedRequest({ type: "ovir-gui:get-results" })).toEqual({ type: "ovir-gui:get-results", paths: null });
      expect(parseEmbedRequest({ type: "ovir-gui:get-results", paths: null })).toEqual({
        type: "ovir-gui:get-results",
        paths: null,
      });
    });

    it.each([["/a.png"], [[null]], [{}]])("rejects paths that are not a list of strings: %o", (paths) => {
      expect(parseEmbedRequest({ type: "ovir-gui:get-results", paths })).toBe("paths must be a list of server paths");
    });
  });

  it.each([[null], [undefined], ["ovir-gui:open"], [42], [["ovir-gui:open"]], [{}], [{ type: 1 }]])(
    "rejects data without a string type: %o",
    (data) => {
      expect(parseEmbedRequest(data)).toBe("a request needs a string type");
    },
  );

  it("rejects an unknown request type", () => {
    expect(parseEmbedRequest({ type: "ovir-gui:delete", paths: ["/a.png"] })).toBe(
      "unknown request type ovir-gui:delete",
    );
    expect(parseEmbedRequest({ type: "ovir-gui:response" })).toBe("unknown request type ovir-gui:response");
  });

  it("ignores extra fields", () => {
    expect(parseEmbedRequest({ type: "ovir-gui:close", paths: [], request_id: "1", extra: true })).toEqual({
      type: "ovir-gui:close",
      paths: [],
    });
  });
});

interface Posted {
  message: unknown;
  origin: string;
}

interface FakeMessage {
  source: unknown;
  origin: string;
  data: unknown;
}

type MessageListener = (event: FakeMessage) => void;

/**
 * The embedding page: it only receives posted messages.
 */
class FakeParent {
  readonly posted: Posted[] = [];

  postMessage(message: unknown, origin: string): void {
    this.posted.push({ message, origin });
  }
}

/**
 * The global window of the embedded app: it only keeps message listeners.
 */
class FakeWindow {
  private readonly listeners = new Set<MessageListener>();

  addEventListener(type: string, listener: MessageListener): void {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: MessageListener): void {
    if (type === "message") this.listeners.delete(listener);
  }

  dispatch(event: FakeMessage): void {
    for (const listener of this.listeners) listener(event);
  }
}

/**
 * The fake parent as the embedding page's Window, which node does not have.
 */
function asWindow(fake: FakeParent): Window {
  return fake as unknown as Window;
}

const ORIGIN = "https://host.example";
const OTHER_ORIGIN = "https://other.example";

const DOCUMENT: ObjectDocument = {
  format: "ovir-gui-objects",
  version: 1,
  model: "detector",
  coordinate_space: "pixels",
  pictures: [],
};

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("EmbedBridge", () => {
  let parent: FakeParent;
  let fakeWindow: FakeWindow;
  let handlers: EmbedHandlers & {
    open: ReturnType<typeof vi.fn<EmbedHandlers["open"]>>;
    show: ReturnType<typeof vi.fn<EmbedHandlers["show"]>>;
    close: ReturnType<typeof vi.fn<EmbedHandlers["close"]>>;
    results: ReturnType<typeof vi.fn<EmbedHandlers["results"]>>;
  };
  let bridge: EmbedBridge;

  function send(data: unknown, options: { origin?: string; source?: unknown } = {}): void {
    fakeWindow.dispatch({ source: "source" in options ? options.source : parent, origin: options.origin ?? ORIGIN, data });
  }

  beforeEach(() => {
    parent = new FakeParent();
    fakeWindow = new FakeWindow();
    vi.stubGlobal("window", fakeWindow);
    handlers = {
      open: vi.fn<EmbedHandlers["open"]>(() => Promise.resolve()),
      show: vi.fn<EmbedHandlers["show"]>(() => Promise.resolve()),
      close: vi.fn<EmbedHandlers["close"]>(() => Promise.resolve()),
      results: vi.fn<EmbedHandlers["results"]>(() => Promise.resolve(DOCUMENT)),
    };
    bridge = new EmbedBridge(asWindow(parent), [ORIGIN, OTHER_ORIGIN], handlers);
    bridge.start();
    parent.posted.length = 0;
  });

  afterEach(() => {
    bridge.stop();
    vi.unstubAllGlobals();
  });

  it("announces readiness to every allowed origin on start", () => {
    const other = new FakeParent();
    const started = new EmbedBridge(asWindow(other), [ORIGIN, OTHER_ORIGIN], handlers);
    started.start();
    started.stop();
    expect(other.posted).toEqual([
      { message: { type: "ovir-gui:ready", version: EMBED_PROTOCOL_VERSION }, origin: ORIGIN },
      { message: { type: "ovir-gui:ready", version: EMBED_PROTOCOL_VERSION }, origin: OTHER_ORIGIN },
    ]);
  });

  it("runs a valid request and answers to its origin with the request id", async () => {
    send({ type: "ovir-gui:open", paths: ["/a.png"], show: "/a.png", request_id: "r1" }, { origin: OTHER_ORIGIN });
    await settle();
    expect(handlers.open).toHaveBeenCalledWith(["/a.png"], "/a.png");
    expect(parent.posted).toEqual([
      { message: { type: "ovir-gui:response", request_id: "r1", ok: true, payload: null }, origin: OTHER_ORIGIN },
    ]);
  });

  it("passes show, close and get-results to their handlers", async () => {
    send({ type: "ovir-gui:show", path: "/v.mp4", frame: 4 });
    send({ type: "ovir-gui:close", paths: ["/v.mp4"] });
    send({ type: "ovir-gui:get-results", paths: null, request_id: "r3" });
    await settle();
    expect(handlers.show).toHaveBeenCalledWith("/v.mp4", 4);
    expect(handlers.close).toHaveBeenCalledWith(["/v.mp4"]);
    expect(handlers.results).toHaveBeenCalledWith(null);
    expect(parent.posted).toContainEqual({
      message: { type: "ovir-gui:response", request_id: "r3", ok: true, payload: DOCUMENT },
      origin: ORIGIN,
    });
  });

  it("ignores messages from an origin that is not allowed", async () => {
    send({ type: "ovir-gui:close", paths: [], request_id: "r1" }, { origin: "https://evil.example" });
    send({ type: "ovir-gui:close", paths: [] }, { origin: `${ORIGIN}/` });
    send({ type: "ovir-gui:close", paths: [] }, { origin: "null" });
    await settle();
    expect(handlers.close).not.toHaveBeenCalled();
    expect(parent.posted).toEqual([]);
  });

  it("ignores messages from a window other than the parent", async () => {
    send({ type: "ovir-gui:close", paths: [] }, { source: new FakeParent() });
    send({ type: "ovir-gui:close", paths: [] }, { source: null });
    await settle();
    expect(handlers.close).not.toHaveBeenCalled();
    expect(parent.posted).toEqual([]);
  });

  it("answers a malformed request with the error and does not run any handler", async () => {
    send({ type: "ovir-gui:open", paths: [], request_id: "r2" });
    await settle();
    expect(handlers.open).not.toHaveBeenCalled();
    expect(parent.posted).toEqual([
      {
        message: {
          type: "ovir-gui:response",
          request_id: "r2",
          ok: false,
          error: "open needs paths: a non-empty list of server paths",
        },
        origin: ORIGIN,
      },
    ]);
  });

  it.each([[undefined], [7], [null], [["r1"]]])("answers without a request id when it is not a string: %o", async (requestId) => {
    send({ type: "ovir-gui:close", paths: [], request_id: requestId });
    await settle();
    expect(parent.posted).toEqual([
      { message: { type: "ovir-gui:response", request_id: null, ok: true, payload: null }, origin: ORIGIN },
    ]);
  });

  it("answers data that is not an object without a request id", async () => {
    send("ovir-gui:close");
    await settle();
    expect(parent.posted).toEqual([
      {
        message: { type: "ovir-gui:response", request_id: null, ok: false, error: "a request needs a string type" },
        origin: ORIGIN,
      },
    ]);
  });

  it("answers a failing handler with its error message", async () => {
    handlers.show.mockRejectedValueOnce(new Error("no such picture"));
    handlers.close.mockRejectedValueOnce("closed already");
    send({ type: "ovir-gui:show", path: "/x.png", request_id: "a" });
    send({ type: "ovir-gui:close", paths: [], request_id: "b" });
    await settle();
    expect(parent.posted).toEqual([
      { message: { type: "ovir-gui:response", request_id: "a", ok: false, error: "no such picture" }, origin: ORIGIN },
      { message: { type: "ovir-gui:response", request_id: "b", ok: false, error: "closed already" }, origin: ORIGIN },
    ]);
  });

  it("sends notices only to the origin of the parent once it has spoken", async () => {
    const notice = { type: "ovir-gui:current-changed", path: "/a.png", frame: null } as const;
    bridge.notify(notice);
    expect(parent.posted.map((posted) => posted.origin)).toEqual([ORIGIN, OTHER_ORIGIN]);
    parent.posted.length = 0;
    send({ type: "ovir-gui:unknown" }, { origin: OTHER_ORIGIN });
    await settle();
    parent.posted.length = 0;
    bridge.notify(notice);
    expect(parent.posted).toEqual([{ message: notice, origin: OTHER_ORIGIN }]);
  });

  it("does not let an ignored message choose the notice origin", () => {
    send({ type: "ovir-gui:close", paths: [] }, { origin: "https://evil.example" });
    bridge.notify({ type: "ovir-gui:current-changed", path: null, frame: null });
    expect(parent.posted.map((posted) => posted.origin)).toEqual([ORIGIN, OTHER_ORIGIN]);
  });

  it("stops listening after stop", async () => {
    bridge.stop();
    send({ type: "ovir-gui:close", paths: [] });
    await settle();
    expect(handlers.close).not.toHaveBeenCalled();
    expect(parent.posted).toEqual([]);
  });
});
