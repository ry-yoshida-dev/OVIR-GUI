from ...models import (
    BackendTraits,
    ComputeDevice,
    ComputePrecision,
    DeviceAvailability,
    LicenseConsent,
    LicensedDependency,
    ModelSelection,
    ModelSelector,
    RecognitionModel,
    SegmentationMode,
    ThresholdControls,
)
from ...prompting import QueryKind
from ...recognition import RecognitionTask
from ...workspace import Workspace
from ..json_value import JsonObject, JsonValue


class ModelPanelBuilder:
    """
    JSON document of the model settings: the presets of every backend of the current task, the chosen model with its
    overrides, the devices and precisions this machine runs, and the licenses of optional modules.
    """

    def model(self, workspace: Workspace) -> JsonObject:
        """
        Model settings of the current task.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.

        Returns
        -------
        JsonObject
            Backends with their presets, segmentation modes, the chosen model and what it takes, devices, precisions,
            box detectors, licenses and the current selection.
        """
        selector: ModelSelector = workspace.models.model_selector
        selection: ModelSelection = workspace.models.selection
        model: RecognitionModel = workspace.models.current_model()
        task: RecognitionTask = workspace.task
        traits_by_backend: dict[str, BackendTraits] = {
            backend: selector.traits_of(task, backend) for backend in selector.backends_of(task)
        }
        backends: list[JsonValue] = [
            {
                "value": backend,
                "presets": [
                    {
                        "name": preset.name,
                        "label": preset.label,
                        "licenses": self._licenses_of(selector.base_model(task, backend, preset.name)),
                    }
                    for preset in selector.presets_of(task, backend)
                ],
                "image_poolings": list[JsonValue](traits.image_poolings),
                "is_box_prompted": traits.is_box_prompted,
                "mode": self._mode_value(traits.segmentation_mode),
            }
            for backend, traits in traits_by_backend.items()
        ]
        modes: list[JsonValue] = [
            {"value": mode.value, "title": mode.title}
            for mode in dict.fromkeys(
                traits.segmentation_mode
                for traits in traits_by_backend.values()
                if traits.segmentation_mode is not None
            )
        ]
        availability: DeviceAvailability = selector.device_availability
        text_templates: tuple[str, ...] | None = model.text_templates
        return {
            "backends": backends,
            "modes": modes,
            "mode": self._mode_value(selector.traits_of(task, selection.backend).segmentation_mode),
            "prompt_mode": model.prompt_mode.value,
            "drawing_kinds": [
                kind.value for kind in QueryKind if kind in model.supported_query_kinds and kind.is_drawn_on_picture
            ],
            "is_sequential": model.is_sequential,
            "is_point_supported": model.is_point_supported,
            "tuning": self._tuning(model.threshold_controls),
            "devices": [
                {"value": device.value, "is_available": availability.is_available(device)} for device in ComputeDevice
            ],
            "precisions": [
                {
                    "value": precision.value,
                    "label": precision.short_name,
                    "is_available": precision in model.supported_precisions
                    and availability.is_precision_supported(selection.device, precision),
                }
                for precision in ComputePrecision
            ],
            "box_detectors": [
                {"label": label, "licenses": self._licenses_of(selector.box_detector_model(label))}
                for label in selector.box_detector_labels_of(task)
            ],
            "licenses": self._license_entries(workspace.models.license_consent),
            "selection": self._selection(selection),
            "is_image_prompt_supported": workspace.models.is_image_prompt_supported(),
            "query_kinds": list[JsonValue](sorted(kind.value for kind in model.supported_query_kinds)),
            "text_templates": None if text_templates is None else list[JsonValue](text_templates),
            "weights_path": model.weights_path,
            "description": model.usage_description,
        }

    @staticmethod
    def _mode_value(mode: SegmentationMode | None) -> JsonValue:
        return None if mode is None else mode.value

    @staticmethod
    def _tuning(controls: ThresholdControls) -> JsonObject:
        return {
            "confidence_label": controls.confidence_label,
            "is_nms_shown": controls.is_nms_shown,
            "is_minimum_confidence_shown": controls.is_minimum_confidence_shown,
        }

    @staticmethod
    def _licenses_of(model: RecognitionModel) -> list[JsonValue]:
        return [dependency.value for dependency in sorted(model.licensed_dependencies, key=lambda entry: entry.value)]

    @staticmethod
    def _license_entries(consent: LicenseConsent) -> list[JsonValue]:
        return [
            {
                "value": dependency.value,
                "title": dependency.title,
                "license_name": dependency.license_name,
                "license_url": dependency.license_url,
                "notice": dependency.notice,
                "install_command": dependency.install_command,
                "is_installed": dependency.is_installed,
                "is_accepted": consent.is_accepted(dependency),
            }
            for dependency in LicensedDependency
        ]

    @staticmethod
    def _selection(selection: ModelSelection) -> JsonObject:
        return {
            "backend": selection.backend,
            "preset_name": selection.preset_name,
            "device": selection.device.value,
            "precision": selection.precision.value,
            "confidence_threshold": selection.confidence_threshold,
            "nms_iou_threshold": selection.nms_iou_threshold,
            "image_pooling": selection.image_pooling,
            "box_detector_label": selection.box_detector_label,
            "tiling_grid_size": selection.tiling_grid_size,
            "text_templates": None if selection.text_templates is None else list[JsonValue](selection.text_templates),
            "batch_size": selection.batch_size,
        }
