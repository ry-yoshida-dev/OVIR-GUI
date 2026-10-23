from dataclasses import dataclass

from ..wording import CountedNoun


@dataclass(frozen=True)
class ClassSetSummary:
    """
    Counts describing a class set, read from its manifest without decoding any image.

    Attributes
    ----------
    class_names : tuple[str, ...]
        Class names in class id order.
    phrase_count : int
        Number of text prompts over all classes.
    reference_image_count : int
        Number of distinct reference images.
    """

    class_names: tuple[str, ...]
    phrase_count: int
    reference_image_count: int

    @property
    def description(self) -> str:
        """
        One-line description of the counts.

        Returns
        -------
        str
            E.g. ``"3 classes · 5 text prompts · 2 images"``; zero counts of prompts and images are left out.
        """
        parts: list[str] = [CountedNoun("class", "classes").of(len(self.class_names))]
        if self.phrase_count:
            parts.append(CountedNoun("text prompt").of(self.phrase_count))
        if self.reference_image_count:
            parts.append(CountedNoun("image").of(self.reference_image_count))
        return " · ".join(parts)
