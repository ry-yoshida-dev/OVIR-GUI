import { useEffect, useState } from "react";

export function usePreloadedSource(source: string | null): string | null {
  const [loaded, setLoaded] = useState<string | null>(source);
  useEffect(() => {
    if (source === null) {
      setLoaded(null);
      return;
    }
    let isCurrent = true;
    const image = new Image();
    image.onload = () => {
      if (isCurrent) setLoaded(source);
    };
    image.onerror = () => {
      if (isCurrent) setLoaded(source);
    };
    image.src = source;
    return () => {
      isCurrent = false;
    };
  }, [source]);
  return loaded;
}
