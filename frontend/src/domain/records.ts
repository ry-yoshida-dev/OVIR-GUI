/**
 * Returns a copy of the record with the key set to the value, or without the key when the value is null.
 */
export function withEntry<Value>(
  record: Readonly<Record<string, Value>>,
  key: string,
  value: Value | null,
): Record<string, Value> {
  const { [key]: _removed, ...rest } = record;
  return value === null ? rest : { ...record, [key]: value };
}
