/**
 * Returns a copy of the set in which the value is a member exactly when requested.
 */
export function withMembership<Value>(
  set: Iterable<Value>,
  value: Value,
  isMember: boolean,
): Set<Value> {
  const next = new Set(set);
  if (isMember) next.add(value);
  else next.delete(value);
  return next;
}

/**
 * Returns a copy of the set with the value added when absent and removed when present.
 */
export function toggledMembership<Value>(
  set: ReadonlySet<Value>,
  value: Value,
): Set<Value> {
  return withMembership(set, value, !set.has(value));
}
