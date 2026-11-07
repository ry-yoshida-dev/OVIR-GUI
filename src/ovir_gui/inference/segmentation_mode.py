from enum import Enum

from ..prompting import PromptMode


class SegmentationMode(Enum):
    """
    Interface of ``open_vocabulary_segmentation`` a segmentation preset runs, each read from its own preset folder.

    A backend of the segmentation task is written ``"<folder>/<family>"`` for every mode but ``CONCEPT``, whose
    backends are the plain family names, e.g. ``"sam3"``, ``"promptable/sam2"`` or ``"tracker/sam2"``.

    Attributes
    ----------
    CONCEPT : str
        Every instance of phrases, reference images or exemplar boxes (``OpenVocabularySegmenter``).
    PROMPTABLE : str
        The single object of each mark of points and a box (``PromptableSegmenter``).
    GENERATION : str
        Every region of the picture without any prompt (``AutomaticMaskGenerator``).
    OBJECT_TRACKING : str
        Objects marked on some frames, followed through the video (``ObjectTracker``).
    CONCEPT_TRACKING : str
        Every instance of phrases or reference images, detected and followed through the video (``ConceptTracker``).
    """

    CONCEPT = "concept"
    PROMPTABLE = "promptable"
    GENERATION = "generation"
    OBJECT_TRACKING = "tracker"
    CONCEPT_TRACKING = "concept_tracker"

    @classmethod
    def of_backend(cls, backend: str) -> "SegmentationMode":
        """
        Mode of a segmentation backend.

        Parameters
        ----------
        backend : str
            Backend of a segmentation preset.

        Returns
        -------
        SegmentationMode
            Mode named by the folder prefix, ``CONCEPT`` without one.

        Raises
        ------
        ValueError
            If the prefix names no mode.
        """
        folder, separator, _ = backend.partition("/")
        if not separator:
            return cls.CONCEPT
        mode: SegmentationMode = cls(folder)
        if mode is cls.CONCEPT:
            raise ValueError(f"concept backends have no folder prefix. got {backend!r}")
        return mode

    @classmethod
    def nested_folders(cls) -> tuple[str, ...]:
        """
        Preset folders holding one sub-folder per family.

        Returns
        -------
        tuple[str, ...]
            Folder of every mode but ``CONCEPT``, in declaration order.
        """
        return tuple(mode.value for mode in cls if mode is not cls.CONCEPT)

    @property
    def title(self) -> str:
        """
        Heading of the models of the mode, saying what they segment.

        Returns
        -------
        str
            E.g. ``"Track marked objects"``.
        """
        match self:
            case SegmentationMode.CONCEPT:
                return "Find by phrases or examples"
            case SegmentationMode.PROMPTABLE:
                return "Segment marked objects"
            case SegmentationMode.GENERATION:
                return "Segment everything"
            case SegmentationMode.OBJECT_TRACKING:
                return "Track marked objects"
            case SegmentationMode.CONCEPT_TRACKING:
                return "Track by phrases or examples"

    @property
    def backend_prefix(self) -> str:
        """
        Prefix of the backends of the mode.

        Returns
        -------
        str
            ``"<folder>/"``, or empty for ``CONCEPT``.
        """
        return "" if self is SegmentationMode.CONCEPT else f"{self.value}/"

    @property
    def section_key(self) -> str:
        """
        Top-level section of the presets of the mode.

        Returns
        -------
        str
            E.g. ``"promptable_segmenter"``.
        """
        match self:
            case SegmentationMode.CONCEPT:
                return "segmenter"
            case SegmentationMode.PROMPTABLE:
                return "promptable_segmenter"
            case SegmentationMode.GENERATION:
                return "mask_generator"
            case SegmentationMode.OBJECT_TRACKING:
                return "object_tracker"
            case SegmentationMode.CONCEPT_TRACKING:
                return "concept_tracker"

    @property
    def prompt_mode(self) -> PromptMode:
        """
        How models of the mode are told what to segment.

        Returns
        -------
        PromptMode
            Classes, marks or nothing.
        """
        match self:
            case SegmentationMode.CONCEPT | SegmentationMode.CONCEPT_TRACKING:
                return PromptMode.CLASSES
            case SegmentationMode.PROMPTABLE | SegmentationMode.OBJECT_TRACKING:
                return PromptMode.MARKS
            case SegmentationMode.GENERATION:
                return PromptMode.AUTOMATIC

    @property
    def is_sequential(self) -> bool:
        """
        Whether models of the mode follow objects through a video.

        Returns
        -------
        bool
            True for both tracking modes.
        """
        match self:
            case SegmentationMode.OBJECT_TRACKING | SegmentationMode.CONCEPT_TRACKING:
                return True
            case SegmentationMode.CONCEPT | SegmentationMode.PROMPTABLE | SegmentationMode.GENERATION:
                return False
