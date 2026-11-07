import { useAsyncResource } from "./useAsyncResource";

function preload(source: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(source);
    image.onerror = () => resolve(source);
    image.src = source;
  });
}

/**
 * Returns the image source once the browser has loaded it, keeping the previous source shown meanwhile.
 */
export function usePreloadedSource(source: string | null): string | null {
  return useAsyncResource(source, () => preload(source ?? ""), {
    initialValue: source ?? undefined,
  });
}
