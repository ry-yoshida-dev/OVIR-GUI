export function familyOf(backend: string): string {
  return backend.slice(backend.indexOf("/") + 1);
}
