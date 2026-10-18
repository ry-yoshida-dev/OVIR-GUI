from collections.abc import Sequence
from pathlib import Path

import numpy as np
from geometry import Box2D, Box2DFormat
from object_detection_format import (
    AnnotationDataset,
    AnnotationFormat,
    AnnotationWriter,
    CocoWriter,
    ImageAnnotation,
    ImageSize,
    ObjectAnnotation,
    YoloWriter,
)

from .export_item import ExportItem
from .picture_files import PictureFiles


class BoxAnnotationWriter:
    """
    Writes the boxes of exported instances in a box format of ``object_detection_format``.
    """

    def __init__(self, annotation_format: AnnotationFormat, is_confidence_included: bool) -> None:
        """
        Parameters
        ----------
        annotation_format : AnnotationFormat
            Box format.
        is_confidence_included : bool
            Whether confidences are written where the format allows.
        """
        self._annotation_format: AnnotationFormat = annotation_format
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
            If the format writes one file per picture and two pictures share a file stem.
        """
        annotations: list[ImageAnnotation] = []
        for item in items:
            picture_path: Path | None = pictures.path_of(item.frame_key)
            if picture_path is None:
                continue
            annotations.append(
                ImageAnnotation(
                    image_path=picture_path,
                    image_size=ImageSize(width=item.result.image_size.width, height=item.result.image_size.height),
                    objects=tuple(
                        ObjectAnnotation(
                            box=Box2D.register(
                                value=np.array(instance.box.xyxy, dtype=np.float64), box2d_format=Box2DFormat.XYXY
                            ),
                            class_name=instance.class_name,
                            confidence=instance.confidence,
                        )
                        for instance in item.result.instances
                    ),
                )
            )
        return self._writer().write(AnnotationDataset.from_images(annotations, class_names=class_names), directory)

    def _writer(self) -> AnnotationWriter:
        match self._annotation_format:
            case AnnotationFormat.COCO:
                return CocoWriter(is_confidence_included=self._is_confidence_included)
            case AnnotationFormat.YOLO:
                return YoloWriter(is_confidence_included=self._is_confidence_included)
            case _:
                return self._annotation_format.create_writer()
