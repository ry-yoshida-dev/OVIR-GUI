import json
from pathlib import Path

import pytest
from PIL import Image

from ovir_gui.export import ExportFormat, ExportItem, ExportOptions, ExportReport, ResultExporter
from ovir_gui.media import FrameKey
from ovir_gui.recognition import ClassScore, FrameResult, ImageSize, LabelMode, RecognitionTask

CLASS_NAMES: tuple[str, ...] = ("cat", "dog", "bird")


def item_of(path: Path, scores: tuple[float, ...], labels: tuple[str, ...]) -> ExportItem:
    Image.new("RGB", (24, 16)).save(path)
    result: FrameResult = FrameResult(
        task=RecognitionTask.CLASSIFICATION,
        image_size=ImageSize(24, 16),
        class_scores=tuple(
            ClassScore(
                class_name=name, score=score, logit=0.0, matched_prompt=name, similarity=None, matched_template=None
            )
            for name, score in zip(CLASS_NAMES, scores, strict=True)
        ),
        native_label_mode=LabelMode.MULTI_LABEL,
    )
    return ExportItem(frame_key=FrameKey(path), result=result, labels=labels, seconds=None)


@pytest.fixture
def items(tmp_path: Path) -> list[ExportItem]:
    source: Path = tmp_path / "source"
    source.mkdir()
    return [
        item_of(source / "a.jpg", (0.9, 0.7, 0.1), ("cat", "dog")),
        item_of(source / "b.jpg", (0.2, 0.3, 0.4), ()),
    ]


def export(items: list[ExportItem], export_format: ExportFormat, directory: Path) -> ExportReport:
    options: ExportOptions = ExportOptions(export_format=export_format, output_directory=directory)
    return ResultExporter({}, {}, False).write(items, RecognitionTask.CLASSIFICATION, options, CLASS_NAMES)


class TestLabelAnnotationExport:
    """
    Classifications are written in the formats of ``classification_format``: exported classes are present and the
    other scored classes absent.
    """

    def test_formats_are_offered_for_classification_only(self) -> None:
        offered: tuple[ExportFormat, ...] = ExportFormat.of_task(RecognitionTask.CLASSIFICATION)
        for export_format in (
            ExportFormat.CLASS_COLUMNS_CSV,
            ExportFormat.LABEL_LIST_CSV,
            ExportFormat.HUGGING_FACE,
            ExportFormat.PASCAL_VOC_IMAGE_SETS,
            ExportFormat.OPEN_IMAGES,
        ):
            assert export_format in offered
            assert export_format.group_label == "Training formats"
            assert export_format not in ExportFormat.of_task(RecognitionTask.DETECTION)

    def test_class_columns_csv(self, items: list[ExportItem], tmp_path: Path) -> None:
        export(items, ExportFormat.CLASS_COLUMNS_CSV, tmp_path / "out")
        lines: list[str] = (tmp_path / "out" / "labels.csv").read_text().splitlines()
        assert lines == ["image_path,cat,dog,bird", "../source/a.jpg,1,1,0", "../source/b.jpg,0,0,0"]

    def test_label_list_csv(self, items: list[ExportItem], tmp_path: Path) -> None:
        export(items, ExportFormat.LABEL_LIST_CSV, tmp_path / "out")
        lines: list[str] = (tmp_path / "out" / "labels.csv").read_text().splitlines()
        assert lines == ["image_path,labels", "../source/a.jpg,cat|dog", "../source/b.jpg,"]

    def test_hugging_face_copies_pictures_with_scores(self, items: list[ExportItem], tmp_path: Path) -> None:
        export(items, ExportFormat.HUGGING_FACE, tmp_path / "out")
        records: list[object] = [
            json.loads(line) for line in (tmp_path / "out" / "metadata.jsonl").read_text().splitlines()
        ]
        assert records == [
            {"file_name": "a.jpg", "labels": ["cat", "dog"], "scores": [0.9, 0.7, 0.1]},
            {"file_name": "b.jpg", "labels": [], "scores": [0.2, 0.3, 0.4]},
        ]
        assert (tmp_path / "out" / "a.jpg").is_file()

    def test_pascal_voc_image_sets(self, items: list[ExportItem], tmp_path: Path) -> None:
        export(items, ExportFormat.PASCAL_VOC_IMAGE_SETS, tmp_path / "out")
        image_sets: Path = tmp_path / "out" / "ImageSets" / "Main"
        assert (image_sets / "trainval.txt").read_text() == "a\nb\n"
        assert (image_sets / "dog_trainval.txt").read_text() == "a  1\nb -1\n"

    def test_open_images_keeps_scores_as_machine_labels(self, items: list[ExportItem], tmp_path: Path) -> None:
        export(items, ExportFormat.OPEN_IMAGES, tmp_path / "out")
        lines: list[str] = (tmp_path / "out" / "image_labels.csv").read_text().splitlines()
        assert lines[:3] == [
            "ImageID,Source,LabelName,Confidence",
            "a,machine,cat,0.900000",
            "a,machine,dog,0.700000",
        ]

    def test_open_images_without_scores_writes_verified_labels(self, items: list[ExportItem], tmp_path: Path) -> None:
        options: ExportOptions = ExportOptions(
            export_format=ExportFormat.OPEN_IMAGES, output_directory=tmp_path / "out", is_confidence_included=False
        )
        ResultExporter({}, {}, False).write(items, RecognitionTask.CLASSIFICATION, options, CLASS_NAMES)
        lines: list[str] = (tmp_path / "out" / "image_labels.csv").read_text().splitlines()
        assert lines[1:4] == ["a,verification,cat,1", "a,verification,dog,1", "a,verification,bird,0"]
