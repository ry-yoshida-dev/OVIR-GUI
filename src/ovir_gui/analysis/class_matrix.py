from collections.abc import Mapping, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class ClassMatrix:
    """
    Counts of every ordered pair of classes, such as pictures two classes share or findings one model gives one
    class and the other model another.

    Attributes
    ----------
    class_names : tuple[str, ...]
        Classes of the rows and of the columns, in the same order.
    counts : tuple[tuple[int, ...], ...]
        ``counts[row][column]`` for the classes at those positions.

    Raises
    ------
    ValueError
        If the counts are not square over the classes or a count is negative.
    """

    class_names: tuple[str, ...]
    counts: tuple[tuple[int, ...], ...]

    def __post_init__(self) -> None:
        size: int = len(self.class_names)
        if len(self.counts) != size or any(len(row) != size for row in self.counts):
            raise ValueError(f"counts must be {size} by {size}")
        if any(count < 0 for row in self.counts for count in row):
            raise ValueError("counts must not be negative")

    @classmethod
    def of(cls, class_names: Sequence[str], pair_counts: Mapping[tuple[str, str], int]) -> "ClassMatrix":
        """
        Matrix of counted pairs.

        Parameters
        ----------
        class_names : Sequence[str]
            Classes of the rows and columns.
        pair_counts : Mapping[tuple[str, str], int]
            Count of each ``(row class, column class)``; missing pairs count zero.

        Returns
        -------
        ClassMatrix
            Counts in class order.
        """
        names: tuple[str, ...] = tuple(class_names)
        return cls(
            class_names=names,
            counts=tuple(tuple(pair_counts.get((row, column), 0) for column in names) for row in names),
        )

    @property
    def total_count(self) -> int:
        """
        Sum of every cell.

        Returns
        -------
        int
            Total count.
        """
        return sum(sum(row) for row in self.counts)

    @property
    def off_diagonal_count(self) -> int:
        """
        Sum of the cells pairing two different classes.

        Returns
        -------
        int
            Total minus the diagonal.
        """
        return self.total_count - sum(self.counts[index][index] for index in range(len(self.class_names)))
