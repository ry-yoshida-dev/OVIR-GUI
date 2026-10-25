import type { ClassMatrixPayload } from "../api/types";

export interface ClassPair {
  first: string;
  second: string;
  count: number;
}

/**
 * Pairs of two different classes with the largest counts of a matrix, largest first; a symmetric matrix lists each
 * pair once.
 */
export function topPairsOf(matrix: ClassMatrixPayload, isSymmetric: boolean, limit: number): ClassPair[] {
  const pairs: ClassPair[] = [];
  matrix.class_names.forEach((first, row) => {
    matrix.class_names.forEach((second, column) => {
      if (row === column || (isSymmetric && column > row)) return;
      const count = matrix.counts[row]?.[column] ?? 0;
      if (count > 0) pairs.push({ first, second, count });
    });
  });
  return pairs.toSorted((left, right) => right.count - left.count).slice(0, limit);
}

/**
 * Value on the diagonal of a matrix for one class, zero when the class is not in it.
 */
export function diagonalOf(matrix: ClassMatrixPayload, className: string): number {
  const index = matrix.class_names.indexOf(className);
  return index < 0 ? 0 : (matrix.counts[index]?.[index] ?? 0);
}
