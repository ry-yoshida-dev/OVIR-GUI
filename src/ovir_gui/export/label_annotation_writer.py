from collections.abc import Sequence
from pathlib import Path

from classification_format import (
    AnnotationDataset,
    AnnotationFormat,
    AnnotationWriter,
    CsvLayout,
    CsvWriter,
    HuggingFaceWriter,
    ImageAnnotation,
    LabelAnnotation,
    LabelPresence,
)

from .export_item import ExportItem
from .picture_files import PictureFiles


class LabelAnnotationWriter:
    """
    Writes the classes of exported classifications in a classification format of ``classification_format``.

    Every scored class of a picture is labeled: present when it is exported, absent otherwise. Scores are kept as
    confidences when they are included.
    """

    def __init__(
        self, annotation_format: AnnotationFormat, csv_layout: CsvLayout | None, is_confidence_included: bool
    ) -> None:
        """
        Parameters
        ----------
        annotation_format : AnnotationFormat
            Classification format.
        csv_layout : CsvLayout | None
            Column layout of a CSV table; ``None`` for the other formats.
        is_confidence_included : bool
            Whether scores are written where the format allows.

        Raises
        ------
        ValueError
            If a CSV table has no column layout.
        """
        if annotation_format is AnnotationFormat.CSV and csv_layout is None:
            raise ValueError("a classification CSV table needs a column layout.")
        self._annotation_format: AnnotationFormat = annotation_format
        self._csv_layout: CsvLayout | None = csv_layout
        self._is_confidence_included: bool = is_confidence_included

    def write(
        self, items: Sequence[ExportItem], pictures: PictureFiles, class_names: Sequence[str], directory: Path
    ) -> tuple[Path, ...]:
        """
        Write the annotation files.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures.
        pictures : PictureFiles
            Image file of every picture.
        class_names : Sequence[str]
            Classes placed first in id order.
        directory : Path
            Output directory.

        Returns
        -------
        tuple[Path, ...]
            Written files.

        Raises
        ------
        ValueError
            If the format names files after pictures and two pictures share a name, or a written image would replace
            a source.
        """
        annotations: list[ImageAnnotation] = []
        for item in items:
            picture_path: Path | None = pictures.path_of(item.frame_key)
            if picture_path is None:
                continue
            exported_class_names: frozenset[str] = frozenset(item.labels)
            annotations.append(
                ImageAnnotation(
                    image_path=picture_path,
                    labels=tuple(
                        LabelAnnotation(
                            class_name=score.class_name,
                            presence=(
                                LabelPresence.PRESENT
                                if score.class_name in exported_class_names
                                else LabelPresence.ABSENT
                            ),
                            confidence=score.score if self._is_confidence_included else None,
                        )
                        for score in item.result.class_scores
                    ),
                )
            )
        return self._writer().write(AnnotationDataset.from_images(annotations, class_names=class_names), directory)

    def _writer(self) -> AnnotationWriter:
        match self._annotation_format:
            case AnnotationFormat.CSV if self._csv_layout is not None:
                return CsvWriter(self._csv_layout)
            case AnnotationFormat.HUGGING_FACE:
                return HuggingFaceWriter(is_confidence_included=self._is_confidence_included)
            case _:
                return self._annotation_format.create_writer()
