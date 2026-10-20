from collections.abc import Mapping, Sequence
from importlib.resources import files
from importlib.resources.abc import Traversable
from typing import ClassVar

from ..recognition import RecognitionTask
from .model_preset import ModelPreset
from .segmentation_mode import SegmentationMode


class PresetCatalog:
    """
    Model presets of every task, discovered from ``<root>/<backend>/<name>.yaml``.

    By default the roots are the ``config`` directories shipped with the three model libraries. A nested folder of a
    task holds one sub-directory per family, read as backend ``"<folder>/<family>"``; the segmentation library keeps
    its promptable, generation and tracking presets that way. Backends are listed in the order the library declares
    them, plain backends before nested ones, and presets of a backend by name.

    Attributes
    ----------
    presets : tuple[ModelPreset, ...]
        Every discovered preset, ordered by task, backend and name.
    """

    PRESET_SUFFIX: ClassVar[str] = ".yaml"
    CONFIG_DIRECTORY_NAME: ClassVar[str] = "config"
    PACKAGE_NAMES: ClassVar[Mapping[RecognitionTask, str]] = {
        RecognitionTask.CLASSIFICATION: "open_vocabulary_classification",
        RecognitionTask.DETECTION: "open_vocabulary_detector",
        RecognitionTask.SEGMENTATION: "open_vocabulary_segmentation",
    }

    def __init__(
        self,
        roots: Mapping[RecognitionTask, Traversable],
        backend_order: Mapping[RecognitionTask, Sequence[str]],
        nested_folders: Mapping[RecognitionTask, Sequence[str]] | None = None,
    ) -> None:
        """
        Parameters
        ----------
        roots : Mapping[RecognitionTask, Traversable]
            Directory of presets of each task, one sub-directory per backend.
        backend_order : Mapping[RecognitionTask, Sequence[str]]
            Families of each task in display order; other sub-directories follow by name.
        nested_folders : Mapping[RecognitionTask, Sequence[str]] | None, optional
            Sub-directories of each task holding one sub-directory per family, in display order; none by default.

        Raises
        ------
        FileNotFoundError
            If no preset is found at all.
        """
        presets: list[ModelPreset] = []
        for task in RecognitionTask:
            root: Traversable | None = roots.get(task)
            if root is None or not root.is_dir():
                continue
            order: Sequence[str] = backend_order.get(task, ())
            folders: Sequence[str] = () if nested_folders is None else nested_folders.get(task, ())
            presets.extend(self._discover(task, root, order, "", frozenset(folders)))
            for folder in folders:
                nested_root: Traversable = root.joinpath(folder)
                if nested_root.is_dir():
                    presets.extend(self._discover(task, nested_root, order, f"{folder}/", frozenset()))
        if not presets:
            raise FileNotFoundError("no model presets found")
        self.presets: tuple[ModelPreset, ...] = tuple(presets)

    @classmethod
    def from_packages(cls) -> "PresetCatalog":
        """
        Catalog of the presets shipped with the model libraries.

        Returns
        -------
        PresetCatalog
            Presets of classification, detection and segmentation.
        """
        from open_vocabulary_classification import ClassifierBackend
        from open_vocabulary_detector import DetectorBackend
        from open_vocabulary_segmentation import SegmenterBackend

        return cls(
            {task: files(package).joinpath(cls.CONFIG_DIRECTORY_NAME) for task, package in cls.PACKAGE_NAMES.items()},
            {
                RecognitionTask.CLASSIFICATION: [backend.value for backend in ClassifierBackend],
                RecognitionTask.DETECTION: [backend.value for backend in DetectorBackend],
                RecognitionTask.SEGMENTATION: [backend.value for backend in SegmenterBackend],
            },
            {RecognitionTask.SEGMENTATION: SegmentationMode.nested_folders()},
        )

    @property
    def tasks(self) -> tuple[RecognitionTask, ...]:
        """
        Tasks having at least one preset.

        Returns
        -------
        tuple[RecognitionTask, ...]
            Tasks in declaration order.
        """
        return tuple(task for task in RecognitionTask if any(preset.task is task for preset in self.presets))

    def backends_of(self, task: RecognitionTask) -> tuple[str, ...]:
        """
        Backends of a task having at least one preset.

        Parameters
        ----------
        task : RecognitionTask
            Task to look up.

        Returns
        -------
        tuple[str, ...]
            Backends in catalog order.
        """
        return tuple(dict.fromkeys(preset.backend for preset in self.presets if preset.task is task))

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
            Presets ordered by name.
        """
        return tuple(preset for preset in self.presets if preset.task is task and preset.backend == backend)

    def preset(self, task: RecognitionTask, backend: str, name: str) -> ModelPreset:
        """
        Look up one preset.

        Parameters
        ----------
        task : RecognitionTask
            Task of the preset.
        backend : str
            Model family.
        name : str
            Preset name.

        Returns
        -------
        ModelPreset
            The preset.

        Raises
        ------
        KeyError
            If no such preset exists.
        """
        for preset in self.presets_of(task, backend):
            if preset.name == name:
                return preset
        available: list[str] = [preset.name for preset in self.presets_of(task, backend)]
        raise KeyError(f"no {task.value} preset {backend}/{name}. available: {available}")

    def _discover(
        self,
        task: RecognitionTask,
        root: Traversable,
        backend_order: Sequence[str],
        backend_prefix: str,
        skipped_names: frozenset[str],
    ) -> list[ModelPreset]:
        backend_directories: list[Traversable] = [
            entry for entry in root.iterdir() if entry.is_dir() and entry.name not in skipped_names
        ]
        ranked: list[Traversable] = sorted(
            backend_directories,
            key=lambda entry: (
                backend_order.index(entry.name) if entry.name in backend_order else len(backend_order),
                entry.name,
            ),
        )
        presets: list[ModelPreset] = []
        for backend_directory in ranked:
            preset_files: list[Traversable] = sorted(
                (
                    entry
                    for entry in backend_directory.iterdir()
                    if entry.is_file() and entry.name.endswith(self.PRESET_SUFFIX)
                ),
                key=lambda entry: entry.name,
            )
            presets.extend(
                ModelPreset(
                    task=task,
                    backend=f"{backend_prefix}{backend_directory.name}",
                    name=entry.name.removesuffix(self.PRESET_SUFFIX),
                    source=entry,
                )
                for entry in preset_files
            )
        return presets
