import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { RankedScore } from "../api/types";

interface LoadedScores {
  pictureKey: string;
  scores: RankedScore[];
}

export function useClassScores(
  pictureKey: string | null,
  path: string | null,
  frame: number | null,
  refreshToken: object | null,
): RankedScore[] | null {
  const [loaded, setLoaded] = useState<LoadedScores | null>(null);
  useEffect(() => {
    if (pictureKey === null || path === null) return;
    let isCurrent = true;
    api
      .frame(path, frame)
      .then((payload) => {
        if (isCurrent) setLoaded({ pictureKey, scores: payload.scores });
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [pictureKey, path, frame, refreshToken]);
  return loaded !== null && loaded.pictureKey === pictureKey ? loaded.scores : null;
}
