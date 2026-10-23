import { useCallback, useMemo } from "react";
import { api } from "../api/client";
import type {
  DuplicateSuppression,
  Thresholds,
  WorkspaceState,
} from "../api/types";
import { ReviewFilter } from "../lib/reviewFilter";
import type { Call } from "./useActionRunner";
import { type DraftValue, useDraftValue } from "./useDraftValue";

export interface ReviewDraft {
  thresholds: DraftValue<Thresholds>;
  suppression: DraftValue<DuplicateSuppression>;
  reviewFilter: ReviewFilter | null;
  draftFilter: ReviewFilter | null;
}

/**
 * Holds the review thresholds being dragged before the server confirms them, with the filter that previews them.
 */
export function useReviewDraft(
  state: WorkspaceState | null,
  call: Call,
): ReviewDraft {
  const commitThresholds = useCallback(
    (thresholds: Thresholds) => call(() => api.setThresholds(thresholds)),
    [call],
  );
  const commitSuppression = useCallback(
    (suppression: DuplicateSuppression) =>
      call(() => api.setSuppression(suppression)),
    [call],
  );
  const thresholds = useDraftValue(state?.thresholds ?? null, commitThresholds);
  const suppression = useDraftValue(
    state?.suppression ?? null,
    commitSuppression,
  );
  const reviewFilter = useMemo(
    () =>
      thresholds.value === null || suppression.value === null
        ? null
        : new ReviewFilter(thresholds.value, suppression.value),
    [thresholds.value, suppression.value],
  );
  const draftFilter =
    thresholds.isDraft || suppression.isDraft ? reviewFilter : null;
  return { thresholds, suppression, reviewFilter, draftFilter };
}
