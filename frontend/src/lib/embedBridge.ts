import type { ObjectDocument } from "../api/types";

export const EMBED_PROTOCOL_VERSION = 1;

export interface EmbedHandlers {
  open: (paths: string[], shownPath: string | null) => Promise<void>;
  show: (path: string, frame: number | null) => Promise<void>;
  close: (paths: string[]) => Promise<void>;
  results: (paths: string[] | null) => Promise<ObjectDocument>;
}

export type EmbedRequest =
  | { type: "ovir-gui:open"; paths: string[]; show: string | null }
  | { type: "ovir-gui:show"; path: string; frame: number | null }
  | { type: "ovir-gui:close"; paths: string[] }
  | { type: "ovir-gui:get-results"; paths: string[] | null };

export type EmbedNotice =
  | { type: "ovir-gui:ready"; version: number }
  | {
      type: "ovir-gui:current-changed";
      path: string | null;
      frame: number | null;
    };

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringsOf(value: unknown): string[] | null {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function optionalStringsOf(value: unknown): string[] | null | undefined {
  return value === undefined || value === null
    ? null
    : (stringsOf(value) ?? undefined);
}

function optionalStringOf(value: unknown): string | null | undefined {
  return value === undefined || value === null
    ? null
    : typeof value === "string"
      ? value
      : undefined;
}

function optionalFrameOf(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

export function parseEmbedRequest(data: unknown): EmbedRequest | string {
  if (!isFields(data) || typeof data.type !== "string")
    return "a request needs a string type";
  switch (data.type) {
    case "ovir-gui:open": {
      const paths = stringsOf(data.paths);
      const shownPath = optionalStringOf(data.show);
      if (paths === null || paths.length === 0)
        return "open needs paths: a non-empty list of server paths";
      if (shownPath === undefined) return "show must be a path";
      return { type: data.type, paths, show: shownPath };
    }
    case "ovir-gui:show": {
      const frame = optionalFrameOf(data.frame);
      if (typeof data.path !== "string") return "show needs a path";
      if (frame === undefined) return "frame must be a non-negative integer";
      return { type: data.type, path: data.path, frame };
    }
    case "ovir-gui:close": {
      const paths = stringsOf(data.paths);
      if (paths === null) return "close needs paths: a list of server paths";
      return { type: data.type, paths };
    }
    case "ovir-gui:get-results": {
      const paths = optionalStringsOf(data.paths);
      if (paths === undefined) return "paths must be a list of server paths";
      return { type: data.type, paths };
    }
    default:
      return `unknown request type ${data.type}`;
  }
}

export class EmbedBridge {
  private readonly parent: Window;
  private readonly origins: readonly string[];
  private readonly handlers: EmbedHandlers;
  private parentOrigin: string | null = null;

  constructor(
    parent: Window,
    origins: readonly string[],
    handlers: EmbedHandlers,
  ) {
    this.parent = parent;
    this.origins = origins;
    this.handlers = handlers;
  }

  start(): void {
    window.addEventListener("message", this.onMessage);
    this.notify({ type: "ovir-gui:ready", version: EMBED_PROTOCOL_VERSION });
  }

  stop(): void {
    window.removeEventListener("message", this.onMessage);
  }

  notify(notice: EmbedNotice): void {
    const targets =
      this.parentOrigin === null ? this.origins : [this.parentOrigin];
    for (const origin of targets) {
      this.parent.postMessage(notice, origin);
    }
  }

  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== this.parent || !this.origins.includes(event.origin))
      return;
    this.parentOrigin = event.origin;
    const requestId =
      isFields(event.data) && typeof event.data.request_id === "string"
        ? event.data.request_id
        : null;
    const request = parseEmbedRequest(event.data);
    if (typeof request === "string") {
      this.respond(event.origin, requestId, { ok: false, error: request });
      return;
    }
    this.handle(request)
      .then((payload) =>
        this.respond(event.origin, requestId, { ok: true, payload }),
      )
      .catch((error: unknown) =>
        this.respond(event.origin, requestId, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
  };

  private async handle(request: EmbedRequest): Promise<ObjectDocument | null> {
    switch (request.type) {
      case "ovir-gui:open":
        await this.handlers.open(request.paths, request.show);
        return null;
      case "ovir-gui:show":
        await this.handlers.show(request.path, request.frame);
        return null;
      case "ovir-gui:close":
        await this.handlers.close(request.paths);
        return null;
      case "ovir-gui:get-results":
        return this.handlers.results(request.paths);
    }
  }

  private respond(
    origin: string,
    requestId: string | null,
    outcome:
      | { ok: true; payload: ObjectDocument | null }
      | { ok: false; error: string },
  ): void {
    this.parent.postMessage(
      { type: "ovir-gui:response", request_id: requestId, ...outcome },
      origin,
    );
  }
}
