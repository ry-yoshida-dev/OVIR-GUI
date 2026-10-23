import type { ClassEntry } from "../../api/types";

export type TreeRow =
  | { kind: "class"; classIndex: number }
  | { kind: "phrase"; classIndex: number; phraseIndex: number }
  | { kind: "reference"; classIndex: number; name: string; digest: string };

export type Editing =
  | { kind: "rename-class"; classIndex: number }
  | { kind: "rename-phrase"; classIndex: number; phraseIndex: number }
  | { kind: "new-class"; position: number }
  | { kind: "new-phrase"; classIndex: number; position: number };

export type DragPayload =
  | { kind: "phrase"; classIndex: number; phraseIndex: number }
  | { kind: "reference"; classIndex: number; name: string; digest: string };

export type DropTarget =
  | { kind: "into-class"; classIndex: number }
  | { kind: "before-class"; classIndex: number }
  | { kind: "before-phrase"; classIndex: number; phraseIndex: number }
  | { kind: "end" };

export interface RemovalBody {
  class_indices: number[];
  phrases: { class_index: number; phrase_index: number }[];
  references: { class_index: number; name: string; digest: string }[];
}

export function isSameRow(left: TreeRow | null, right: TreeRow): boolean {
  if (left === null || left.kind !== right.kind) return false;
  if (left.classIndex !== right.classIndex) return false;
  switch (left.kind) {
    case "class":
      return true;
    case "phrase":
      return right.kind === "phrase" && left.phraseIndex === right.phraseIndex;
    case "reference":
      return (
        right.kind === "reference" &&
        left.digest === right.digest &&
        left.name === right.name
      );
  }
}

export function isRowPresent(row: TreeRow, classes: ClassEntry[]): boolean {
  const entry = classes[row.classIndex];
  if (entry === undefined) return false;
  switch (row.kind) {
    case "class":
      return true;
    case "phrase":
      return row.phraseIndex < entry.phrases.length;
    case "reference":
      return entry.references.some(
        (reference) => reference.digest === row.digest,
      );
  }
}

export function removalOf(row: TreeRow): RemovalBody {
  return {
    class_indices: row.kind === "class" ? [row.classIndex] : [],
    phrases:
      row.kind === "phrase"
        ? [{ class_index: row.classIndex, phrase_index: row.phraseIndex }]
        : [],
    references:
      row.kind === "reference"
        ? [
            {
              class_index: row.classIndex,
              name: row.name,
              digest: row.digest,
            },
          ]
        : [],
  };
}
