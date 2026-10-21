import { useCallback, useEffect, useRef, useState } from "react";

const COMMIT_DELAY_MILLISECONDS = 120;

export interface DraftValue<T> {
  value: T | null;
  isDraft: boolean;
  change: (value: T) => void;
}

function isSameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    typeof left !== "object" ||
    typeof right !== "object" ||
    left === null ||
    right === null
  )
    return false;
  const leftEntries = Object.entries(left);
  const rightRecord = right as Record<string, unknown>;
  return (
    leftEntries.length === Object.keys(rightRecord).length &&
    leftEntries.every(
      ([key, value]) =>
        key in rightRecord && isSameValue(value, rightRecord[key]),
    )
  );
}

export function useDraftValue<T extends object>(
  committed: T | null,
  onCommit: (value: T) => Promise<boolean>,
): DraftValue<T> {
  const [draft, setDraft] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const sent = useRef<T | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    setDraft((current) =>
      current !== null &&
      timer.current === undefined &&
      committed !== null &&
      isSameValue(current, committed)
        ? null
        : current,
    );
  }, [committed]);

  const change = useCallback(
    (value: T) => {
      setDraft(value);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        sent.current = value;
        void onCommit(value).then((isCommitted) => {
          if (!isCommitted && sent.current === value) setDraft(null);
        });
      }, COMMIT_DELAY_MILLISECONDS);
    },
    [onCommit],
  );

  return { value: draft ?? committed, isDraft: draft !== null, change };
}
