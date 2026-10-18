from collections.abc import Mapping, Sequence
from pathlib import Path

from object_detection_format import AnnotationFormat

from ..media import MediaItem
from ..recognition import RecognitionTask
from .annotated_image_writer import AnnotatedImageWriter
from .annotated_video_writer import AnnotatedVideoWriter
from .box_annotation_writer import BoxAnnotationWriter
from .class_folder_writer import ClassFolderWriter
from .coco_segmentation_writer import CocoSegmentationWriter
from .export_format import ExportFormat
from .export_item import ExportItem
from .export_options import ExportOptions
from .export_report import ExportReport
from .mask_image_writer import MaskImageWriter
from .overlay_renderer import OverlayRenderer
from .picture_files import PictureFiles
from .table_export_writer import TableExportWriter
from .yolo_segmentation_writer import YoloSegmentationWriter


class ResultExporter:
    """
    Writes exported pictures in the chosen format, with optional annotated images and videos; runs off the owning
    thread and touches only what it is given.
    """

    def __init__(
        self, media: Mapping[Path, MediaItem], class_colors: Mapping[str, str], is_label_confidence_shown: bool
    ) -> None:
        """
        Parameters
        ----------
        media : Mapping[Path, MediaItem]
            Open media, telling videos apart.
        class_colors : Mapping[str, str]
            ``#rrggbb`` color of every class for drawings.
        is_label_confidence_shown : bool
            Whether drawn labels carry the confidence.
        """
        self._media: dict[Path, MediaItem] = dict(media)
        self._renderer: OverlayRenderer = OverlayRenderer(class_colors, is_label_confidence_shown)

    def write(
        self, items: Sequence[ExportItem], task: RecognitionTask, options: ExportOptions, class_names: Sequence[str]
    ) -> ExportReport:
        """
        Export the pictures.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures with their selected findings.
        task : RecognitionTask
            Task of the results.
        options : ExportOptions
            Format, destination and extras.
        class_names : Sequence[str]
            Current classes in id order.

        Returns
        -------
        ExportReport
            Counts and written files.

        Raises
        ------
        ValueError
            If nothing is exported or the format does not fit the task.
        OSError
            If a file cannot be written.
        """
        if not items:
            raise ValueError("No recognized pictures to export.")
        export_format: ExportFormat = options.export_format
        if task not in export_format.tasks:
            raise ValueError(f"{export_format.label} cannot hold {task.value} results.")
        directory: Path = options.output_directory
        directory.mkdir(parents=True, exist_ok=True)
        pictures: PictureFiles = PictureFiles(directory, self._media)
        if export_format.needs_picture_files:
            pictures.prepare([item.frame_key for item in items])
        written: list[Path] = list(pictures.written_paths)
        written.extend(self._write_format(items, task, options, class_names, pictures))
        annotated_count: int | None = None
        if options.is_annotated_image_saved:
            annotated_paths: tuple[Path, ...] = AnnotatedImageWriter(self._renderer).write(
                items, self._media, directory
            )
            written.extend(annotated_paths)
            annotated_count = len(annotated_paths)
        if options.is_annotated_video_saved:
            video_paths: tuple[Path, ...] = AnnotatedVideoWriter(self._renderer).write(items, self._media, directory)
            written.extend(video_paths)
            annotated_count = (annotated_count or 0) + len(video_paths)
        return ExportReport(
            format_name=export_format.label,
            output_directory=directory,
            picture_count=len(items),
            finding_count=sum(
                (1 if item.label is not None else 0)
                if task is RecognitionTask.CLASSIFICATION
                else len(item.result.instances)
                for item in items
            ),
            written_paths=tuple(written),
            annotated_count=annotated_count,
        )

    @staticmethod
    def _write_format(
        items: Sequence[ExportItem],
        task: RecognitionTask,
        options: ExportOptions,
        class_names: Sequence[str],
        pictures: PictureFiles,
    ) -> tuple[Path, ...]:
        directory: Path = options.output_directory
        is_confidence_included: bool = options.is_confidence_included
        match options.export_format:
            case ExportFormat.CSV:
                return (TableExportWriter(is_confidence_included).write_csv(items, task, class_names, directory),)
            case ExportFormat.JSON:
                return (TableExportWriter(is_confidence_included).write_json(items, task, class_names, directory),)
            case (
                ExportFormat.COCO
                | ExportFormat.YOLO
                | ExportFormat.PASCAL_VOC
                | ExportFormat.LABELME
                | ExportFormat.CREATE_ML
            ):
                annotation_format: AnnotationFormat | None = options.export_format.annotation_format
                if annotation_format is None:
                    raise ValueError(f"{options.export_format.label} has no box writer.")
                return BoxAnnotationWriter(annotation_format, is_confidence_included).write(
                    items, pictures, class_names, directory
                )
            case ExportFormat.COCO_SEGMENTATION:
                return CocoSegmentationWriter(is_confidence_included).write(items, pictures, class_names, directory)
            case ExportFormat.YOLO_SEGMENTATION:
                return YoloSegmentationWriter(is_confidence_included).write(items, pictures, class_names, directory)
            case ExportFormat.MASK_PNG:
                return MaskImageWriter().write(items, pictures, class_names, directory)
            case ExportFormat.CLASS_FOLDERS:
                return ClassFolderWriter().write(items, pictures, directory)
