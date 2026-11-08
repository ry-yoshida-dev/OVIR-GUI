/**
 * One drawing on the shown picture: an object marked there, or an exemplar box by its position among the boxes.
 */
export type PromptItem = { kind: "object"; objectId: number } | { kind: "exemplar"; index: number };

export function isSameItem(left: PromptItem | null, right: PromptItem | null): boolean {
  if (left === null || right === null) return left === right;
  if (left.kind === "object") return right.kind === "object" && left.objectId === right.objectId;
  return right.kind === "exemplar" && left.index === right.index;
}
