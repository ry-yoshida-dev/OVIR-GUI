from collections.abc import Mapping
from types import MappingProxyType


class ClassThresholds:
    """
    Minimum confidence a finding needs to be kept: a default one, replaced per class, in turn replaced per prompt.

    Findings below their minimum stay stored but are dimmed or hidden in the results and the image, and left out of
    exports, so the cut can be tuned without recognizing again. A prompt is the phrase or reference image that matched
    a finding, so a class queried by several prompts can keep a loose prompt strict. Minimums are keyed by class name
    and prompt, so they survive reordering the classes.
    """

    def __init__(
        self,
        default_minimum: float = 0.0,
        class_minimums: Mapping[str, float] | None = None,
        prompt_minimums: Mapping[str, Mapping[str, float]] | None = None,
    ) -> None:
        """
        Parameters
        ----------
        default_minimum : float, optional
            Minimum of every class without its own, in ``[0, 1]``.
        class_minimums : Mapping[str, float] | None, optional
            Own minimum of some classes, in ``[0, 1]``; ``None`` sets none.
        prompt_minimums : Mapping[str, Mapping[str, float]] | None, optional
            Own minimum of some prompts by class name and prompt, in ``[0, 1]``; ``None`` sets none.

        Raises
        ------
        ValueError
            If a minimum is outside ``[0, 1]`` or a class name or prompt is blank.
        """
        minimums: dict[str, float] = dict(class_minimums or {})
        prompts: dict[str, MappingProxyType[str, float]] = {
            class_name: MappingProxyType(dict(by_prompt))
            for class_name, by_prompt in (prompt_minimums or {}).items()
            if by_prompt
        }
        named_minimums: list[tuple[str, float]] = [
            ("default", default_minimum),
            *minimums.items(),
            *(
                (f"{class_name}/{prompt}", minimum)
                for class_name, by_prompt in prompts.items()
                for prompt, minimum in by_prompt.items()
            ),
        ]
        for name, minimum in named_minimums:
            if not 0.0 <= minimum <= 1.0:
                raise ValueError(f"minimum confidence of {name} must be in [0, 1]. got {minimum}")
        if any(not class_name.strip() for class_name in (*minimums, *prompts)):
            raise ValueError(f"class names must not be blank. got {[*minimums, *prompts]}")
        if any(not prompt.strip() for by_prompt in prompts.values() for prompt in by_prompt):
            raise ValueError(f"prompts must not be blank. got {[list(by_prompt) for by_prompt in prompts.values()]}")
        self._default_minimum: float = default_minimum
        self._class_minimums: MappingProxyType[str, float] = MappingProxyType(minimums)
        self._prompt_minimums: MappingProxyType[str, MappingProxyType[str, float]] = MappingProxyType(prompts)

    def __eq__(self, other: object) -> bool:
        return (
            isinstance(other, ClassThresholds)
            and self._default_minimum == other._default_minimum
            and dict(self._class_minimums) == dict(other._class_minimums)
            and self._plain_prompt_minimums() == other._plain_prompt_minimums()
        )

    def __hash__(self) -> int:
        return hash(
            (
                self._default_minimum,
                frozenset(self._class_minimums.items()),
                frozenset(
                    (class_name, frozenset(by_prompt.items()))
                    for class_name, by_prompt in self._prompt_minimums.items()
                ),
            )
        )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(default_minimum={self._default_minimum}, {dict(self._class_minimums)}, "
            + f"{self._plain_prompt_minimums()})"
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
    def prompt_minimums(self) -> Mapping[str, Mapping[str, float]]:
        """
        Phrases with their own minimum.

        Returns
        -------
        Mapping[str, Mapping[str, float]]
            Read-only view of the minimum of each such prompt, by class name and prompt.
        """
        return self._prompt_minimums

    def minimum_of(self, class_name: str, matched_prompt: str | None = None) -> float:
        """
        Minimum confidence of one class or one of its prompts.

        Parameters
        ----------
        class_name : str
            Class to look up.
        matched_prompt : str | None, optional
            Matched prompt of the class; ``None`` looks up the class alone.

        Returns
        -------
        float
            The own minimum of the prompt, else of the class, else the default one.
        """
        if matched_prompt is not None:
            by_prompt: Mapping[str, float] | None = self._prompt_minimums.get(class_name)
            prompt_minimum: float | None = None if by_prompt is None else by_prompt.get(matched_prompt)
            if prompt_minimum is not None:
                return prompt_minimum
        return self._class_minimums.get(class_name, self._default_minimum)

    def is_reaching_minimum(self, class_name: str, matched_prompt: str, confidence: float) -> bool:
        """
        Whether a finding reaches the minimum of its prompt.

        Parameters
        ----------
        class_name : str
            Class of the finding.
        matched_prompt : str
            Prompt that matched the finding.
        confidence : float
            Confidence of the finding.

        Returns
        -------
        bool
            True when ``confidence`` is at least the minimum of the prompt of ``class_name``.
        """
        return confidence >= self.minimum_of(class_name, matched_prompt)

    def _plain_prompt_minimums(self) -> dict[str, dict[str, float]]:
        return {class_name: dict(by_prompt) for class_name, by_prompt in self._prompt_minimums.items()}
