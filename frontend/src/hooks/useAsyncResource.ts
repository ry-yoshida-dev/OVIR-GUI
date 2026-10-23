import { useEffect, useEffectEvent, useState } from "react";

interface AsyncResourceOptions<Value> {
  debounceMilliseconds?: number | ((previous: Value | null) => number);
  isStaleShown?: boolean;
  initialValue?: Value;
  onLoaded?: (value: Value) => void;
  onError?: (error: unknown) => void;
}

interface AccumulatedResourceOptions<Loaded, Value>
  extends AsyncResourceOptions<Value> {
  accumulate: (loaded: Loaded, previous: Value | null) => Value;
}

interface LoadedEntry<Value> {
  key: string;
  value: Value;
}

function keepLoaded<Value>(loaded: Value): Value {
  return loaded;
}

/**
 * Loads whenever the key changes, ignoring answers that arrive after the key moved on, and folds every answer into
 * the value loaded before. A null key clears the value without loading; otherwise the last value stays shown while
 * the next one loads unless isStaleShown is false.
 */
export function useAccumulatedResource<Loaded, Value>(
  key: string | null,
  load: (previous: Value | null) => Promise<Loaded>,
  {
    accumulate,
    debounceMilliseconds = 0,
    isStaleShown = true,
    initialValue,
    onLoaded,
    onError,
  }: AccumulatedResourceOptions<Loaded, Value>,
): Value | null {
  const [entry, setEntry] = useState<LoadedEntry<Value> | null>(() =>
    key === null || initialValue === undefined
      ? null
      : { key, value: initialValue },
  );
  if (key === null && entry !== null) setEntry(null);
  const previous = entry?.value ?? null;
  const startLoading = useEffectEvent(() => load(previous));
  const delayOf = useEffectEvent(() =>
    typeof debounceMilliseconds === "function"
      ? debounceMilliseconds(previous)
      : debounceMilliseconds,
  );
  const settle = useEffectEvent((loadedKey: string, loaded: Loaded) => {
    const value = accumulate(loaded, previous);
    setEntry({ key: loadedKey, value });
    onLoaded?.(value);
  });
  const fail = useEffectEvent((error: unknown) => onError?.(error));

  useEffect(() => {
    if (key === null) return;
    let isCurrent = true;
    const start = () => {
      startLoading()
        .then((loaded) => {
          if (isCurrent) settle(key, loaded);
        })
        .catch((error: unknown) => {
          if (isCurrent) fail(error);
        });
    };
    const delay = delayOf();
    const timer = delay > 0 ? window.setTimeout(start, delay) : undefined;
    if (timer === undefined) start();
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [key]);

  if (key === null || entry === null) return null;
  return isStaleShown || entry.key === key ? entry.value : null;
}

/**
 * Loads a value whenever the key changes, ignoring answers that arrive after the key moved on. A null key clears
 * the value without loading; otherwise the last value stays shown while the next one loads unless isStaleShown is
 * false.
 */
export function useAsyncResource<Value>(
  key: string | null,
  load: () => Promise<Value>,
  options: AsyncResourceOptions<Value> = {},
): Value | null {
  return useAccumulatedResource<Value, Value>(key, load, {
    ...options,
    accumulate: keepLoaded,
  });
}
