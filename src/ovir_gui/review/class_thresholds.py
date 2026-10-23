from collections.abc import Mapping
from types import MappingProxyType


class ClassThresholds:
    """
    Minimum confidence a finding needs to be kept: a default one, replaced per class, in turn replaced per phrase.

    Findings below their minimum stay stored but are dimmed or hidden in the results and the image, and left out of
    exports, so the cut can be tuned without recognizing again. A phrase is the query that matched a finding, so a
    class queried by several phrases can keep a loose phrase strict. Minimums are keyed by class name and phrase, so
    they survive reordering the classes.
    """

    def __init__(
        self,
        default_minimum: float = 0.0,
        class_minimums: Mapping[str, float] | None = None,
        phrase_minimums: Mapping[str, Mapping[str, float]] | None = None,
    ) -> None:
        """
        Parameters
        ----------
        default_minimum : float, optional
            Minimum of every class without its own, in ``[0, 1]``.
        class_minimums : Mapping[str, float] | None, optional
            Own minimum of some classes, in ``[0, 1]``; ``None`` sets none.
        phrase_minimums : Mapping[str, Mapping[str, float]] | None, optional
            Own minimum of some phrases by class name and phrase, in ``[0, 1]``; ``None`` sets none.

        Raises
        ------
        ValueError
            If a minimum is outside ``[0, 1]`` or a class name or phrase is blank.
        """
        minimums: dict[str, float] = dict(class_minimums or {})
        phrases: dict[str, MappingProxyType[str, float]] = {
            class_name: MappingProxyType(dict(by_phrase))
            for class_name, by_phrase in (phrase_minimums or {}).items()
            if by_phrase
        }
        named_minimums: list[tuple[str, float]] = [
            ("default", default_minimum),
            *minimums.items(),
            *(
                (f"{class_name}/{phrase}", minimum)
                for class_name, by_phrase in phrases.items()
                for phrase, minimum in by_phrase.items()
            ),
        ]
        for name, minimum in named_minimums:
            if not 0.0 <= minimum <= 1.0:
                raise ValueError(f"minimum confidence of {name} must be in [0, 1]. got {minimum}")
        if any(not class_name.strip() for class_name in (*minimums, *phrases)):
            raise ValueError(f"class names must not be blank. got {[*minimums, *phrases]}")
        if any(not phrase.strip() for by_phrase in phrases.values() for phrase in by_phrase):
            raise ValueError(f"phrases must not be blank. got {[list(by_phrase) for by_phrase in phrases.values()]}")
        self._default_minimum: float = default_minimum
        self._class_minimums: MappingProxyType[str, float] = MappingProxyType(minimums)
        self._phrase_minimums: MappingProxyType[str, MappingProxyType[str, float]] = MappingProxyType(phrases)

    def __eq__(self, other: object) -> bool:
        return (
            isinstance(other, ClassThresholds)
            and self._default_minimum == other._default_minimum
            and dict(self._class_minimums) == dict(other._class_minimums)
            and self._plain_phrase_minimums() == other._plain_phrase_minimums()
        )

    def __hash__(self) -> int:
        return hash(
            (
                self._default_minimum,
                frozenset(self._class_minimums.items()),
                frozenset(
                    (class_name, frozenset(by_phrase.items()))
                    for class_name, by_phrase in self._phrase_minimums.items()
                ),
            )
        )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(default_minimum={self._default_minimum}, {dict(self._class_minimums)}, "
            + f"{self._plain_phrase_minimums()})"
        )

    @property
    def default_minimum(self) -> float:
        """
        Minimum of every class without its own.

        Returns
        -------
        float
            Confidence in ``[0, 1]``; 0 keeps every detection.
        """
        return self._default_minimum

    @property
    def class_minimums(self) -> Mapping[str, float]:
        """
        Classes with their own minimum.

        Returns
        -------
        Mapping[str, float]
            Read-only view of the minimum of each such class.
        """
        return self._class_minimums

    @property
    def phrase_minimums(self) -> Mapping[str, Mapping[str, float]]:
        """
        Phrases with their own minimum.

        Returns
        -------
        Mapping[str, Mapping[str, float]]
            Read-only view of the minimum of each such phrase, by class name and phrase.
        """
        return self._phrase_minimums

    def minimum_of(self, class_name: str, query_label: str | None = None) -> float:
        """
        Minimum confidence of one class or one of its phrases.

        Parameters
        ----------
        class_name : str
            Class to look up.
        query_label : str | None, optional
            Phrase of the class; ``None`` looks up the class alone.

        Returns
        -------
        float
            The own minimum of the phrase, else of the class, else the default one.
        """
        if query_label is not None:
            by_phrase: Mapping[str, float] | None = self._phrase_minimums.get(class_name)
            phrase_minimum: float | None = None if by_phrase is None else by_phrase.get(query_label)
            if phrase_minimum is not None:
                return phrase_minimum
        return self._class_minimums.get(class_name, self._default_minimum)

    def is_reaching_minimum(self, class_name: str, query_label: str, confidence: float) -> bool:
        """
        Whether a finding reaches the minimum of its phrase.

        Parameters
        ----------
        class_name : str
            Class of the finding.
        query_label : str
            Phrase that matched the finding.
        confidence : float
            Confidence of the finding.

        Returns
        -------
        bool
            True when ``confidence`` is at least the minimum of the phrase of ``class_name``.
        """
        return confidence >= self.minimum_of(class_name, query_label)

    def _plain_phrase_minimums(self) -> dict[str, dict[str, float]]:
        return {class_name: dict(by_phrase) for class_name, by_phrase in self._phrase_minimums.items()}
