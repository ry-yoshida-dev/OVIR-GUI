from collections.abc import Sequence
from dataclasses import dataclass
from typing import ClassVar


@dataclass(frozen=True)
class ThresholdCurve:
    """
    How many accepted findings of one class, and how many pictures with one, a minimum confidence would keep, for
    every minimum from 0 to 1 in equal steps; duplicate suppression is not applied.

    Attributes
    ----------
    finding_counts : tuple[int, ...]
        Findings with a confidence at or above ``step / STEP_COUNT``, for every step.
    picture_counts : tuple[int, ...]
        Pictures whose best finding of the class reaches ``step / STEP_COUNT``, for every step.

    Raises
    ------
    ValueError
        If either count list does not have one count per step.
    """

    STEP_COUNT: ClassVar[int] = 100

    finding_counts: tuple[int, ...]
    picture_counts: tuple[int, ...]

    def __post_init__(self) -> None:
        expected: int = self.STEP_COUNT + 1
        if len(self.finding_counts) != expected or len(self.picture_counts) != expected:
            raise ValueError(f"a threshold curve needs {expected} counts per series")

    @classmethod
    def of(cls, picture_confidences: Sequence[Sequence[float]]) -> "ThresholdCurve":
        """
        Count what every minimum keeps.

        Parameters
        ----------
        picture_confidences : Sequence[Sequence[float]]
            Confidences of the accepted findings of the class, one sequence per picture with any.

        Returns
        -------
        ThresholdCurve
            Counts per step.
        """
        finding_steps: list[int] = [0] * (cls.STEP_COUNT + 2)
        picture_steps: list[int] = [0] * (cls.STEP_COUNT + 2)
        for confidences in picture_confidences:
            if not confidences:
                continue
            for confidence in confidences:
                finding_steps[cls._reached_step(confidence) + 1] -= 1
                finding_steps[0] += 1
            picture_steps[cls._reached_step(max(confidences)) + 1] -= 1
            picture_steps[0] += 1
        return cls(
            finding_counts=cls._accumulated(finding_steps),
            picture_counts=cls._accumulated(picture_steps),
        )

    @classmethod
    def _reached_step(cls, confidence: float) -> int:
        step: int = min(int(confidence * cls.STEP_COUNT + 1e-9), cls.STEP_COUNT)
        return max(step, 0)

    @classmethod
    def _accumulated(cls, differences: Sequence[int]) -> tuple[int, ...]:
        counts: list[int] = []
        running: int = 0
        for step in range(cls.STEP_COUNT + 1):
            running += differences[step]
            counts.append(running)
        return tuple(counts)
