import csv
import json
from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

from ..recognition import Finding, RecognitionTask
from ..storage import JsonValue
from .export_item import ExportItem


class TableExportWriter:
    """
    Writes exported results as one CSV table or one JSON document.

    The CSV has a row per instance for detection and segmentation, and a row per picture with its labels, separated by
    ``LABEL_SEPARATOR`` and best first, and the score of every class for classification. The JSON lists every
    picture with its findings; segmentation instances carry their mask outlines as polygons.
    """

    CSV_NAME: ClassVar[str] = "results.csv"
    JSON_NAME: ClassVar[str] = "results.json"
    LABEL_SEPARATOR: ClassVar[str] = ";"

    def __init__(self, is_confidence_included: bool) -> None:
        """
        Parameters
        ----------
        is_confidence_included : bool
            Whether confidences and scores are written.
        """
        self._is_confidence_included: bool = is_confidence_included

    def write_csv(
        self, items: Sequence[ExportItem], task: RecognitionTask, class_names: Sequence[str], directory: Path
    ) -> Path:
        """
        Write the table.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures.
        task : RecognitionTask
            Task of the results.
        class_names : Sequence[str]
            Classes in column order for classification.
        directory : Path
            Output directory.

        Returns
        -------
        Path
            Written file.
        """
        directory.mkdir(parents=True, exist_ok=True)
        target: Path = directory / self.CSV_NAME
        with target.open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            if task is RecognitionTask.CLASSIFICATION:
                header: list[str] = ["media", "frame", "seconds", "labels"]
                if self._is_confidence_included:
                    header.extend(f"score:{name}" for name in class_names)
                writer.writerow(header)
                for item in items:
                    row: list[str] = [
                        str(item.frame_key.path),
                        self._frame_text(item),
                        self._seconds_text(item),
                        self.LABEL_SEPARATOR.join(item.labels),
                    ]
                    if self._is_confidence_included:
                        scores: dict[str, float] = {score.class_name: score.score for score in item.result.class_scores}
                        row.extend(f"{scores[name]:.6f}" if name in scores else "" for name in class_names)
                    writer.writerow(row)
                return target
            header = ["media", "frame", "seconds", "class", "matched_prompt"]
            if self._is_confidence_included:
                header.append("confidence")
            header.extend(["x_min", "y_min", "x_max", "y_max", "area"])
            writer.writerow(header)
            for item in items:
                for index in range(len(item.result.instances)):
                    finding: Finding = item.result.finding_of(index)
                    row = [
                        str(item.frame_key.path),
                        self._frame_text(item),
                        self._seconds_text(item),
                        finding.class_name,
                        "" if finding.matched_prompt is None else finding.matched_prompt,
                    ]
                    if self._is_confidence_included:
                        row.append(f"{finding.confidence:.6f}")
                    box = finding.box
                    row.extend(f"{value:.2f}" for value in (box.xyxy if box is not None else (0.0, 0.0, 0.0, 0.0)))
                    row.append("" if finding.area is None else f"{finding.area:.0f}")
                    writer.writerow(row)
        return target

    def write_json(
        self, items: Sequence[ExportItem], task: RecognitionTask, class_names: Sequence[str], directory: Path
    ) -> Path:
        """
        Write the document.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures.
        task : RecognitionTask
            Task of the results.
        class_names : Sequence[str]
            Classes in id order.
        directory : Path
            Output directory.

        Returns
        -------
        Path
            Written file.
        """
        directory.mkdir(parents=True, exist_ok=True)
        pictures: list[JsonValue] = []
        for item in items:
            entry: dict[str, JsonValue] = {
                "media": str(item.frame_key.path),
                "frame": item.frame_key.frame_index,
                "seconds": item.seconds,
                "width": item.result.image_size.width,
                "height": item.result.image_size.height,
            }
            if task is RecognitionTask.CLASSIFICATION:
                entry["labels"] = list[JsonValue](item.labels)
                if self._is_confidence_included:
                    entry["scores"] = {
                        score.class_name: {
                            "score": score.score,
                            "logit": score.logit,
                            "similarity": score.similarity,
                            "matched_prompt": score.matched_prompt,
                            "best_template": score.matched_template,
                        }
                        for score in item.result.class_scores
                    }
            else:
                instances: list[JsonValue] = []
                for instance in item.result.instances:
                    instance_entry: dict[str, JsonValue] = {
                        "class": instance.class_name,
                        "matched_prompt": instance.matched_prompt,
                        "box": list(instance.box.xyxy),
                    }
                    if self._is_confidence_included:
                        instance_entry["confidence"] = instance.confidence
                    if instance.mask is not None:
                        instance_entry["area"] = instance.mask.area
                        instance_entry["polygons"] = [
                            [coordinate for point in polygon for coordinate in point]
                            for polygon in instance.mask.polygons()
                        ]
                    instances.append(instance_entry)
                entry["instances"] = instances
            pictures.append(entry)
        document: dict[str, JsonValue] = {"task": task.value, "classes": list(class_names), "pictures": pictures}
        target: Path = directory / self.JSON_NAME
        target.write_text(json.dumps(document, ensure_ascii=False, indent=1), encoding="utf-8")
        return target

    @staticmethod
    def _frame_text(item: ExportItem) -> str:
        return "" if item.frame_key.frame_index is None else str(item.frame_key.frame_index)

    @staticmethod
    def _seconds_text(item: ExportItem) -> str:
        return "" if item.seconds is None else f"{item.seconds:.3f}"
