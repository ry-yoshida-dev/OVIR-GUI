import os
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

from huggingface_hub import CachedRepoInfo, HFCacheInfo, scan_cache_dir
from huggingface_hub.constants import HF_HUB_CACHE
from pydantic import TypeAdapter

from .stored_weights import StoredWeights


class WeightsStorage:
    """
    Downloaded weights of the presets on this computer, found where the model libraries put them.

    A Hugging Face repository id such as ``"google/owlv2-base-patch16"`` is stored in the Hugging Face hub cache, read
    and cleaned through ``huggingface_hub``; an Ultralytics file name such as ``"yoloe-11l-seg.pt"`` is stored in the
    directory the server was started in, where Ultralytics downloads it, or in the ``weights_dir`` of the Ultralytics
    settings. Deleted weights are downloaded again the next time their model loads.
    """

    HUB_REPO_TYPE: ClassVar[str] = "model"
    ULTRALYTICS_SUFFIX: ClassVar[str] = ".pt"
    ULTRALYTICS_FOLDER_NAME: ClassVar[str] = "Ultralytics"
    ULTRALYTICS_SETTINGS_NAME: ClassVar[str] = "settings.json"
    ULTRALYTICS_WEIGHTS_KEY: ClassVar[str] = "weights_dir"

    def __init__(self, hub_cache_directory: Path, ultralytics_directories: Sequence[Path]) -> None:
        """
        Parameters
        ----------
        hub_cache_directory : Path
            Hugging Face hub cache.
        ultralytics_directories : Sequence[Path]
            Directories searched in order for Ultralytics weight files.
        """
        self._hub_cache_directory: Path = hub_cache_directory
        self._ultralytics_directories: tuple[Path, ...] = tuple(ultralytics_directories)

    @classmethod
    def on_this_computer(cls) -> "WeightsStorage":
        """
        Storage of the caches the model libraries use for this process.

        Returns
        -------
        WeightsStorage
            Hugging Face hub cache, the current directory and the Ultralytics weights directory.
        """
        ultralytics_weights_directory: Path | None = cls._ultralytics_weights_directory()
        return cls(
            Path(HF_HUB_CACHE),
            [Path.cwd()] if ultralytics_weights_directory is None else [Path.cwd(), ultralytics_weights_directory],
        )

    def stored(self, weights_paths: Sequence[str]) -> tuple[StoredWeights, ...]:
        """
        Weights on this computer among the given checkpoints.

        Parameters
        ----------
        weights_paths : Sequence[str]
            Weights paths of the checkpoints asked about.

        Returns
        -------
        tuple[StoredWeights, ...]
            One entry per distinct downloaded checkpoint, in the given order.
        """
        hub_repositories: dict[str, CachedRepoInfo] = self._hub_repositories(self._hub_cache_info())
        stored_weights: list[StoredWeights] = []
        for weights_path in dict.fromkeys(weights_paths):
            size_bytes: int | None = self._stored_size_of(weights_path, hub_repositories)
            if size_bytes is not None:
                stored_weights.append(StoredWeights(weights_path, size_bytes))
        return tuple(stored_weights)

    def delete(self, weights_path: str) -> None:
        """
        Delete the downloaded weights of a checkpoint from this computer; files the Hugging Face cache shares with
        other repositories are kept for them.

        Parameters
        ----------
        weights_path : str
            Weights path of the checkpoint.

        Raises
        ------
        FileNotFoundError
            If the weights are not on this computer.
        """
        if weights_path.endswith(self.ULTRALYTICS_SUFFIX):
            weights_file: Path | None = self._ultralytics_file_of(weights_path)
            if weights_file is None:
                raise FileNotFoundError(f"{weights_path} is not downloaded.")
            weights_file.unlink()
            return
        cache_info: HFCacheInfo | None = self._hub_cache_info()
        repository: CachedRepoInfo | None = self._hub_repositories(cache_info).get(weights_path)
        if cache_info is None or repository is None:
            raise FileNotFoundError(f"{weights_path} is not downloaded.")
        cache_info.delete_revisions(*(revision.commit_hash for revision in repository.revisions)).execute()

    def _stored_size_of(self, weights_path: str, hub_repositories: dict[str, CachedRepoInfo]) -> int | None:
        if weights_path.endswith(self.ULTRALYTICS_SUFFIX):
            weights_file: Path | None = self._ultralytics_file_of(weights_path)
            return None if weights_file is None else weights_file.stat().st_size
        repository: CachedRepoInfo | None = hub_repositories.get(weights_path)
        return None if repository is None or repository.size_on_disk == 0 else repository.size_on_disk

    def _ultralytics_file_of(self, weights_path: str) -> Path | None:
        return next(
            (
                directory / weights_path
                for directory in self._ultralytics_directories
                if (directory / weights_path).is_file()
            ),
            None,
        )

    def _hub_cache_info(self) -> HFCacheInfo | None:
        if not self._hub_cache_directory.is_dir():
            return None
        return scan_cache_dir(self._hub_cache_directory)

    @classmethod
    def _hub_repositories(cls, cache_info: HFCacheInfo | None) -> dict[str, CachedRepoInfo]:
        if cache_info is None:
            return {}
        return {
            repository.repo_id: repository
            for repository in cache_info.repos
            if repository.repo_type == cls.HUB_REPO_TYPE
        }

    @classmethod
    def _ultralytics_weights_directory(cls) -> Path | None:
        settings_file: Path = cls._ultralytics_config_directory() / cls.ULTRALYTICS_SETTINGS_NAME
        if not settings_file.is_file():
            return None
        settings: dict[str, object] = TypeAdapter(dict[str, object]).validate_json(
            settings_file.read_text(encoding="utf-8")
        )
        weights_directory: object = settings.get(cls.ULTRALYTICS_WEIGHTS_KEY)
        return Path(weights_directory) if isinstance(weights_directory, str) else None

    @classmethod
    def _ultralytics_config_directory(cls) -> Path:
        configured: str | None = os.environ.get("YOLO_CONFIG_DIR")
        if configured is not None:
            return Path(configured)
        home: Path = Path.home()
        match sys.platform:
            case "win32":
                return Path(os.environ.get("APPDATA", str(home / "AppData" / "Roaming"))) / cls.ULTRALYTICS_FOLDER_NAME
            case "darwin":
                return home / "Library" / "Application Support" / cls.ULTRALYTICS_FOLDER_NAME
            case _:
                return Path(os.environ.get("XDG_CONFIG_HOME", str(home / ".config"))) / cls.ULTRALYTICS_FOLDER_NAME
