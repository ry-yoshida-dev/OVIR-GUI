from collections.abc import Mapping
from dataclasses import replace
from typing import ClassVar

from ..recognition import RecognitionTask
from .classification_model import ClassificationModel
from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision
from .concept_tracking_model import ConceptTrackingModel
from .detection_model import DetectionModel
from .device_availability import DeviceAvailability
from .mask_generation_model import MaskGenerationModel
from .model_preset import ModelPreset
from .model_selection import ModelSelection
from .object_tracking_model import ObjectTrackingModel
from .preset_catalog import PresetCatalog
from .promptable_segmentation_model import PromptableSegmentationModel
from .recognition_model import RecognitionModel
from .segmentation_mode import SegmentationMode
from .segmentation_model import SegmentationModel


class ModelSelector:
    """
    Presets that can be chosen for every task, and the model of a chosen preset with its overrides applied.

    Choosing a preset fills every override with the preset values. A device missing on this machine falls back to
    ``ComputeDevice.AUTO``, and a precision the device or library cannot run falls back to float32. Preset files are
    read once and remembered.
    """

    PREFERRED_PRESETS: ClassVar[Mapping[RecognitionTask, tuple[str, str]]] = {
        RecognitionTask.CLASSIFICATION: ("clip", "openai_vit_b32"),
        RecognitionTask.DETECTION: ("grounding_dino", "original_tiny"),
        RecognitionTask.SEGMENTATION: ("sam2", "hiera_tiny"),
    }

    def __init__(self, catalog: PresetCatalog, device_availability: DeviceAvailability) -> None:
        """
        Parameters
        ----------
        catalog : PresetCatalog
            Presets to choose from.
        device_availability : DeviceAvailability
            GPU backends of this machine.
        """
        self._catalog: PresetCatalog = catalog
        self._device_availability: DeviceAvailability = device_availability
        self._base_models: dict[tuple[RecognitionTask, str, str], RecognitionModel] = {}

    @property
    def catalog(self) -> PresetCatalog:
        """
        Presets to choose from.

        Returns
        -------
        PresetCatalog
            Catalog given at construction.
        """
        return self._catalog

    @property
    def device_availability(self) -> DeviceAvailability:
        """
        GPU backends of this machine.

        Returns
        -------
        DeviceAvailability
            Availability given at construction.
        """
        return self._device_availability

    @property
    def tasks(self) -> tuple[RecognitionTask, ...]:
        """
        Tasks with at least one preset.

        Returns
        -------
        tuple[RecognitionTask, ...]
            Tasks in declaration order.
        """
        return self._catalog.tasks

    def backends_of(self, task: RecognitionTask) -> tuple[str, ...]:
        """
        Backends of a task.

        Parameters
        ----------
        task : RecognitionTask
            Task to look up.

        Returns
        -------
        tuple[str, ...]
            Backends in catalog order.
        """
        return self._catalog.backends_of(task)

    def presets_of(self, task: RecognitionTask, backend: str) -> tuple[ModelPreset, ...]:
        """
        Presets of one backend.

        Parameters
        ----------
        task : RecognitionTask
            Task of the backend.
        backend : str
            Model family.

        Returns
        -------
        tuple[ModelPreset, ...]
            Presets in catalog order.
        """
        return self._catalog.presets_of(task, backend)

    @property
    def box_detector_labels(self) -> tuple[str, ...]:
        """
        Detection presets that can find the boxes a segmenter masks.

        Returns
        -------
        tuple[str, ...]
            ``"<backend>/<name>"`` of every detection preset.
        """
        return tuple(
            preset.label
            for backend in self._catalog.backends_of(RecognitionTask.DETECTION)
            for preset in self._catalog.presets_of(RecognitionTask.DETECTION, backend)
        )

    def default_selection(self, task: RecognitionTask) -> ModelSelection:
        """
        Preferred light preset of a task, or its first preset, with its own values.

        Parameters
        ----------
        task : RecognitionTask
            Task to choose a model for.

        Returns
        -------
        ModelSelection
            Selection of the preset.

        Raises
        ------
        KeyError
            If the task has no preset.
        """
        preferred: tuple[str, str] | None = self.PREFERRED_PRESETS.get(task)
        if preferred is not None and any(preset.name == preferred[1] for preset in self.presets_of(task, preferred[0])):
            return self.selection_of(task, preferred[0], preferred[1])
        backends: tuple[str, ...] = self.backends_of(task)
        if not backends:
            raise KeyError(f"no {task.value} presets are available.")
        return self.selection_of(task, backends[0], self.presets_of(task, backends[0])[0].name)

    def selection_of(self, task: RecognitionTask, backend: str, preset_name: str) -> ModelSelection:
        """
        Selection of a preset with every override filled from the preset.

        Parameters
        ----------
        task : RecognitionTask
            Task of the preset.
        backend : str
            Model family.
        preset_name : str
            Preset name.

        Returns
        -------
        ModelSelection
            Preset values runnable on this machine.

        Raises
        ------
        KeyError
            If no such preset exists.
        """
        selection: ModelSelection = self.base_model(task, backend, preset_name).as_selection()
        device: ComputeDevice = (
            selection.device if self._device_availability.is_available(selection.device) else ComputeDevice.AUTO
        )
        precision: ComputePrecision = (
            selection.precision
            if self._device_availability.is_precision_supported(device, selection.precision)
            else ComputePrecision.FLOAT32
        )
        return replace(selection, device=device, precision=precision)

    def validated(self, selection: ModelSelection) -> ModelSelection:
        """
        Selection that can run on this machine, with the options the model does not take cleared.

        Parameters
        ----------
        selection : ModelSelection
            Requested selection.

        Returns
        -------
        ModelSelection
            ``selection`` with a precision the device or library cannot run replaced by float32, and the thresholds the
            class minimums take over and the batch size of models running one picture at a time cleared; a missing
            batch size is filled in with the preset's.

        Raises
        ------
        KeyError
            If the preset or the box detector preset does not exist.
        ValueError
            If the device is not available or the pooling is not offered by the backend.
        """
        base: RecognitionModel = self.base_model(selection.task, selection.backend, selection.preset_name)
        if not self._device_availability.is_available(selection.device):
            raise ValueError(f"The device {selection.device.value} is not available on this machine.")
        validated: ModelSelection = selection
        if selection.batch_size is None:
            validated = replace(validated, batch_size=base.as_selection().batch_size)
        if selection.precision not in base.supported_precisions or not self._device_availability.is_precision_supported(
            selection.device, selection.precision
        ):
            validated = replace(validated, precision=ComputePrecision.FLOAT32)
        match base:
            case ClassificationModel():
                poolings: tuple[str, ...] = ClassificationModel.image_poolings_of(selection.backend)
                if selection.image_pooling is not None and selection.image_pooling not in poolings:
                    raise ValueError(f"{selection.backend} offers the poolings {', '.join(poolings)}.")
            case DetectionModel():
                validated = replace(validated, confidence_threshold=None)
            case SegmentationModel():
                validated = replace(
                    validated,
                    confidence_threshold=None,
                    box_detector_label=selection.box_detector_label if base.is_box_prompted else None,
                )
            case PromptableSegmentationModel():
                validated = replace(
                    validated, confidence_threshold=None, nms_iou_threshold=None, box_detector_label=None
                )
            case ObjectTrackingModel() | ConceptTrackingModel():
                validated = replace(validated, nms_iou_threshold=None, box_detector_label=None, batch_size=None)
            case MaskGenerationModel():
                validated = replace(validated, box_detector_label=None)
            case _:
                pass
        return validated

    def model_of(self, selection: ModelSelection) -> RecognitionModel:
        """
        Model of the chosen preset with the overrides applied.

        Parameters
        ----------
        selection : ModelSelection
            Chosen preset and overrides.

        Returns
        -------
        RecognitionModel
            Model to recognize with.

        Raises
        ------
        KeyError
            If the preset or the box detector preset does not exist.
        """
        base: RecognitionModel = self.base_model(selection.task, selection.backend, selection.preset_name)
        match base:
            case ClassificationModel():
                return base.customized(selection)
            case DetectionModel():
                return base.customized(selection)
            case SegmentationModel():
                box_model: DetectionModel | None = (
                    None
                    if selection.box_detector_label is None
                    else self.box_detector_model(selection.box_detector_label)
                )
                return base.customized(selection, box_model)
            case PromptableSegmentationModel() | MaskGenerationModel() | ObjectTrackingModel() | ConceptTrackingModel():
                return base.customized(selection)
            case _:
                raise TypeError(f"unsupported model {type(base).__name__}")

    def base_model(self, task: RecognitionTask, backend: str, preset_name: str) -> RecognitionModel:
        """
        Model of a preset as written in its file.

        Parameters
        ----------
        task : RecognitionTask
            Task of the preset.
        backend : str
            Model family.
        preset_name : str
            Preset name.

        Returns
        -------
        RecognitionModel
            Model read from the preset, remembered for later calls.

        Raises
        ------
        KeyError
            If no such preset exists.
        """
        key: tuple[RecognitionTask, str, str] = (task, backend, preset_name)
        cached: RecognitionModel | None = self._base_models.get(key)
        if cached is not None:
            return cached
        model: RecognitionModel = self.read_preset(self._catalog.preset(task, backend, preset_name))
        self._base_models[key] = model
        return model

    @classmethod
    def read_preset(cls, preset: ModelPreset) -> RecognitionModel:
        """
        Model of a preset as written in its file, read by the model class of its task and segmentation mode.

        Parameters
        ----------
        preset : ModelPreset
            Preset to read.

        Returns
        -------
        RecognitionModel
            Model of the preset.

        Raises
        ------
        KeyError
            If the preset lacks its section.
        ValueError
            If the section does not describe valid settings of the preset's backend.
        """
        match preset.task:
            case RecognitionTask.CLASSIFICATION:
                return ClassificationModel.from_preset(preset)
            case RecognitionTask.DETECTION:
                return DetectionModel.from_preset(preset)
            case RecognitionTask.SEGMENTATION:
                return cls._segmentation_model_of(preset)

    @staticmethod
    def _segmentation_model_of(preset: ModelPreset) -> RecognitionModel:
        match SegmentationMode.of_backend(preset.backend):
            case SegmentationMode.CONCEPT:
                return SegmentationModel.from_preset(preset)
            case SegmentationMode.PROMPTABLE:
                return PromptableSegmentationModel.from_preset(preset)
            case SegmentationMode.GENERATION:
                return MaskGenerationModel.from_preset(preset)
            case SegmentationMode.OBJECT_TRACKING:
                return ObjectTrackingModel.from_preset(preset)
            case SegmentationMode.CONCEPT_TRACKING:
                return ConceptTrackingModel.from_preset(preset)

    def box_detector_model(self, label: str) -> DetectionModel:
        """
        Detection preset finding the boxes a segmenter masks.

        Parameters
        ----------
        label : str
            ``"<backend>/<name>"`` of a detection preset.

        Returns
        -------
        DetectionModel
            Model of the preset as written in its file.

        Raises
        ------
        KeyError
            If the label is malformed or no such preset exists.
        TypeError
            If the preset is not a detection preset.
        """
        backend, separator, preset_name = label.partition("/")
        if not separator:
            raise KeyError(f"box detector must be written <backend>/<preset>. got {label!r}")
        model: RecognitionModel = self.base_model(RecognitionTask.DETECTION, backend, preset_name)
        if not isinstance(model, DetectionModel):
            raise TypeError(f"{label} is not a detection preset.")
        return model
