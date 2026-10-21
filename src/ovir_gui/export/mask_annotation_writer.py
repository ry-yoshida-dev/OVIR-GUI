import json
from collections import Counter
from collections.abc import Sequence
from pathlib import Path

from segmentation_format import (
    AnnotationDataset,
    AnnotationFormat,
    AnnotationWriter,
    CocoWriter,
    ImageAnnotation,
    ImageSize,
    InstanceAnnotation,
    YoloWriter,
)

from ..recognition.array_types import BoolArray
from ..storage import JsonValue
from .export_item import ExportItem
from .picture_files import PictureFiles


class MaskAnnotationWriter:
    """
    Writes the masks of exported instances in a format of ``segmentation_format``.

    Full-resolution masks are built one picture at a time, so exporting long videos never holds every mask in memory;
    COCO documents of single pictures are merged into one ``annotations.json`` with continuous ids.
    """

    def __init__(self, annotation_format: AnnotationFormat, is_confidence_included: bool) -> None:
        """
        Parameters
        ----------
        annotation_format : AnnotationFormat
            Mask format.
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
            Classes placed first in id order; classes only results report follow.
        directory : Path
            Output directory.

        Returns
        -------
        tuple[Path, ...]
            Written files.

        Raises
        ------
        ValueError
            If two pictures share a file name (COCO) or a file stem (per-picture formats), ignoring case.
        """
        located: list[tuple[Path, ExportItem]] = []
        for item in items:
            picture_path: Path | None = pictures.path_of(item.frame_key)
            if picture_path is not None:
                located.append((picture_path, item))
        ordered_class_names: dict[str, None] = dict.fromkeys(class_names)
        for _, item in located:
            ordered_class_names.update(dict.fromkeys(instance.class_name for instance in item.result.instances))
        all_class_names: tuple[str, ...] = tuple(ordered_class_names)
        directory.mkdir(parents=True, exist_ok=True)
        match self._annotation_format:
            case AnnotationFormat.COCO:
                self._check_unique([picture_path.name for picture_path, _ in located], "file name")
                return self._write_coco(located, all_class_names, directory)
            case _:
                self._check_unique([picture_path.stem for picture_path, _ in located], "file stem")
                return self._write_per_picture(located, all_class_names, directory)

    def _write_per_picture(
        self, located: Sequence[tuple[Path, ExportItem]], class_names: tuple[str, ...], directory: Path
    ) -> tuple[Path, ...]:
        writer: AnnotationWriter = self._writer()
        written: dict[Path, None] = {}
        for picture_path, item in located:
            dataset: AnnotationDataset = AnnotationDataset(
                images=(self._image(picture_path, item),), class_names=class_names
            )
            written.update(dict.fromkeys(writer.write(dataset, directory)))
        return tuple(written)

    def _write_coco(
        self, located: Sequence[tuple[Path, ExportItem]], class_names: tuple[str, ...], directory: Path
    ) -> tuple[Path, ...]:
        writer: CocoWriter = CocoWriter(is_confidence_included=self._is_confidence_included)
        images: list[JsonValue] = []
        annotations: list[JsonValue] = []
        categories: JsonValue = writer.build_document(AnnotationDataset(images=(), class_names=class_names))[
            "categories"
        ]
        for picture_path, item in located:
            dataset: AnnotationDataset = AnnotationDataset(
                images=(self._image(picture_path, item),), class_names=class_names
            )
            document: dict[str, JsonValue] = writer.build_document(dataset)
            image_id: int = len(images) + 1
            for image in self._entries(document, "images"):
                image["id"] = image_id
                images.append(image)
            for annotation in self._entries(document, "annotations"):
                annotation["id"] = len(annotations) + 1
                annotation["image_id"] = image_id
                annotations.append(annotation)
        merged: dict[str, JsonValue] = {"images": images, "annotations": annotations, "categories": categories}
        target: Path = directory / writer.file_name
        target.write_text(json.dumps(merged, ensure_ascii=False), encoding="utf-8")
        return (target,)

    def _writer(self) -> AnnotationWriter:
        match self._annotation_format:
            case AnnotationFormat.YOLO:
                return YoloWriter(is_confidence_included=self._is_confidence_included)
            case _:
                return self._annotation_format.create_writer()

    @staticmethod
    def _image(picture_path: Path, item: ExportItem) -> ImageAnnotation:
        width: int = item.result.image_size.width
        height: int = item.result.image_size.height
        instances: list[InstanceAnnotation] = []
        for instance in item.result.instances:
            if instance.mask is None:
                continue
            mask: BoolArray = instance.mask.dense(width, height)
            if not bool(mask.any()):
                continue
            instances.append(
                InstanceAnnotation(mask=mask, class_name=instance.class_name, confidence=instance.confidence)
            )
        return ImageAnnotation(
            image_path=picture_path, image_size=ImageSize(width=width, height=height), instances=tuple(instances)
        )

    @staticmethod
    def _entries(document: dict[str, JsonValue], key: str) -> list[dict[str, JsonValue]]:
        value: JsonValue = document[key]
        if not isinstance(value, list):
            raise TypeError(f"COCO {key} must be a list. got {type(value).__name__}")
        entries: list[dict[str, JsonValue]] = []
        for entry in value:
            if not isinstance(entry, dict):
                raise TypeError(f"COCO {key} entries must be objects. got {type(entry).__name__}")
            entries.append(entry)
        return entries

    @staticmethod
    def _check_unique(names: Sequence[str], kind: str) -> None:
        counts: Counter[str] = Counter(name.casefold() for name in names)
        duplicates: list[str] = [name for name, count in counts.items() if count > 1]
        if duplicates:
            raise ValueError(f"pictures share a {kind}, their annotations would collide: {duplicates}")
