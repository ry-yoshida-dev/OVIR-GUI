import json
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import ClassVar

from ..media import FrameKey, MediaItem
from ..recognition import RecognitionTask
from .crop_options import CropOptions
from .export_format import ExportFormat
from .export_item import ExportItem
from .export_options import ExportOptions
from .export_report import ExportReport
from .label_preview import LabelPreview
from .result_exporter import ResultExporter


class LabelPreviewer:
    """
    Writes an export into a temporary directory and reads back the label file it wrote, so the preview is exactly
    what the export writes.

    Formats writing one file per picture are written for the shown picture only, the first exported one when it is
    not exported. The label file is the text file of that picture, else the first text file other than a class list,
    else the class list; without any text file the written files are listed.
    """

    TEXT_SUFFIXES: ClassVar[frozenset[str]] = frozenset({".json", ".jsonl", ".txt", ".csv", ".xml"})
    CLASS_LIST_FILE_NAME: ClassVar[str] = "classes.txt"
    MAXIMUM_CHARACTERS: ClassVar[int] = 1_000_000

    def __init__(self, media: Mapping[Path, MediaItem]) -> None:
        """
        Parameters
        ----------
        media : Mapping[Path, MediaItem]
            Open media, copied so the preview can be written off the owning thread.
        """
        self._media: dict[Path, MediaItem] = dict(media)

    def preview(
        self,
        items: Sequence[ExportItem],
        task: RecognitionTask,
        shown_key: FrameKey | None,
        export_format: ExportFormat,
        is_confidence_included: bool,
        crop_options: CropOptions,
        class_names: Sequence[str],
    ) -> LabelPreview:
        """
        Write the export and read its label file.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures with their selected findings.
        task : RecognitionTask
            Task of the results.
        shown_key : FrameKey | None
            Picture shown in the viewer.
        export_format : ExportFormat
            Format written.
        is_confidence_included : bool
            Whether confidences are written.
        crop_options : CropOptions
            Image format and margin of cropped objects.
        class_names : Sequence[str]
            Current classes in id order.

        Returns
        -------
        LabelPreview
            Label file and its text; an empty file name and text when no picture is exported.

        Raises
        ------
        ValueError
            If the format does not fit the task.
        OSError
            If a file cannot be written or read.
        """
        previewed: list[ExportItem] = list(items)
        if not previewed:
            return self._preview("", "", export_format)
        if export_format.is_written_per_picture:
            shown: list[ExportItem] = [item for item in previewed if item.frame_key == shown_key]
            previewed = shown or previewed[:1]
        with tempfile.TemporaryDirectory(prefix="ovir_label_preview_") as temporary:
            directory: Path = Path(temporary)
            options: ExportOptions = ExportOptions(
                export_format=export_format,
                output_directory=directory,
                is_confidence_included=is_confidence_included,
                crop_options=crop_options,
            )
            report: ExportReport = ResultExporter(self._media, {}, False).write(previewed, task, options, class_names)
            stems: frozenset[str] = frozenset(self._stem_of(item.frame_key) for item in previewed)
            label_path: Path | None = self._label_path(report.written_paths, stems)
            if label_path is None:
                listing: str = "".join(f"{path.relative_to(directory).as_posix()}\n" for path in report.written_paths)
                return self._preview("", listing, export_format)
            return self._preview(
                label_path.relative_to(directory).as_posix(), self._readable(label_path), export_format
            )

    def _label_path(self, written_paths: Sequence[Path], stems: frozenset[str]) -> Path | None:
        texts: list[Path] = [path for path in written_paths if path.suffix.lower() in self.TEXT_SUFFIXES]
        for path in texts:
            if path.stem in stems:
                return path
        for path in texts:
            if path.name != self.CLASS_LIST_FILE_NAME:
                return path
        return texts[0] if texts else None

    @staticmethod
    def _readable(path: Path) -> str:
        text: str = path.read_text(encoding="utf-8")
        if path.suffix.lower() != ".json":
            return text
        return json.dumps(json.loads(text), indent=2, ensure_ascii=False) + "\n"

    @staticmethod
    def _stem_of(frame_key: FrameKey) -> str:
        if frame_key.frame_index is None:
            return frame_key.path.stem
        return f"{frame_key.path.stem}_f{frame_key.frame_index:06d}"

    def _preview(self, file_name: str, text: str, export_format: ExportFormat) -> LabelPreview:
        is_truncated: bool = len(text) > self.MAXIMUM_CHARACTERS
        return LabelPreview(
            file_name=file_name,
            text=text[: self.MAXIMUM_CHARACTERS] if is_truncated else text,
            is_shown_picture_only=export_format.is_written_per_picture,
            is_truncated=is_truncated,
        )
