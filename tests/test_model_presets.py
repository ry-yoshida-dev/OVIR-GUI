from dataclasses import replace

import pytest

from ovir_gui.models import (
    ClassificationModel,
    ComputePrecision,
    DetectionModel,
    ModelPreset,
    PresetCatalog,
    RecognitionModel,
    SegmentationModel,
)
from ovir_gui.recognition import RecognitionTask

CATALOG: PresetCatalog = PresetCatalog.from_packages()


class TestModelPresets:
    """
    Every preset shipped with the model libraries is read into the settings of the library it belongs to.
    """

    @staticmethod
    def model_of(preset: ModelPreset) -> RecognitionModel:
        match preset.task:
            case RecognitionTask.CLASSIFICATION:
                return ClassificationModel.from_preset(preset)
            case RecognitionTask.DETECTION:
                return DetectionModel.from_preset(preset)
            case RecognitionTask.SEGMENTATION:
                return SegmentationModel.from_preset(preset)

    def test_every_task_has_presets(self) -> None:
        assert {preset.task for preset in CATALOG.presets} == set(RecognitionTask)

    @pytest.mark.parametrize("preset", CATALOG.presets, ids=lambda preset: preset.label)
    def test_preset_is_read(self, preset: ModelPreset) -> None:
        model: RecognitionModel = self.model_of(preset)
        assert model.precision in model.supported_precisions
        assert model.loading_signature()

    @pytest.mark.parametrize(
        "preset", CATALOG.presets_of(RecognitionTask.SEGMENTATION, "sam3"), ids=lambda preset: preset.label
    )
    @pytest.mark.parametrize("precision", list(ComputePrecision), ids=lambda precision: precision.value)
    def test_segmentation_precision_is_applied(self, preset: ModelPreset, precision: ComputePrecision) -> None:
        model: SegmentationModel = SegmentationModel.from_preset(preset)
        customized: SegmentationModel = model.customized(replace(model.as_selection(), precision=precision), None)
        assert customized.precision is precision
        assert customized.settings.precision.value == precision.value
