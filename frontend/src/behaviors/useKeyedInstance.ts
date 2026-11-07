import { useState } from "react";

/**
 * Keeps one instance per key, creating a fresh one whenever the key changes.
 */
export function useKeyedInstance<Instance>(
  key: string | null,
  create: () => Instance,
): Instance {
  const [entry, setEntry] = useState(() => ({ key, instance: create() }));
  if (entry.key === key) return entry.instance;
  const next = { key, instance: create() };
  setEntry(next);
  return next.instance;
}
