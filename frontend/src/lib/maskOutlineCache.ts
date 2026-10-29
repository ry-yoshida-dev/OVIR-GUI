import { api } from "../api/client";
import { isInstance } from "./frameView";

export type MaskOutlines = ReadonlyMap<number, readonly number[][]>;

/**
 * Mask outlines of the pictures shown in a gallery, loaded once per picture and result; a picture listed under
 * several classes shares one request.
 */
export class MaskOutlineCache {
  private static readonly CAPACITY = 512;
  private readonly loaded = new Map<string, Promise<MaskOutlines>>();

  outlinesOf(path: string, frame: number | null, resultKey: string): Promise<MaskOutlines> {
    const key = JSON.stringify([path, frame, resultKey]);
    const cached = this.loaded.get(key);
    if (cached !== undefined) return cached;
    if (this.loaded.size >= MaskOutlineCache.CAPACITY) this.loaded.clear();
    const loading = api.frame(path, frame).then(
      (payload): MaskOutlines =>
        new Map(payload.findings.filter(isInstance).map((finding) => [finding.index, finding.polygons] as const)),
    );
    loading.catch(() => this.loaded.delete(key));
    this.loaded.set(key, loading);
    return loading;
  }
}
