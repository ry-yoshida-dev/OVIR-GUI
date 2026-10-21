from collections.abc import Iterable
from pathlib import Path
from typing import ClassVar

from ..media import FrameKey
from ..models import ModelProfile
from ..recognition import FrameResult, RecognizedInstance
from ..results import ResultCatalog, StoredResult
from ..review import ReviewFilter
from ..workspace import Workspace
from .json_value import JsonObject, JsonValue


class ObjectDocumentBuilder:
    """
    Self-describing JSON documents of the recognized objects of pictures, handed to applications embedding the user
    interface, such as a GIS that places the outlines on a map.

    Coordinates are pixels of the upright picture (EXIF orientation applied) with the origin at the top-left corner,
    so the embedding application maps them onto its own coordinate system.
    """

    FORMAT_NAME: ClassVar[str] = "ovir-gui-objects"
    FORMAT_VERSION: ClassVar[int] = 1
    COORDINATE_SPACE: ClassVar[str] = "pixels of the upright picture (EXIF orientation applied), origin at top-left"

    def results(self, workspace: Workspace, paths: Iterable[Path] | None) -> JsonObject:
        """
        Kept findings of the shown model on open media files: neither rejected nor below their class minimum.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.
        paths : Iterable[Path] | None
            Open files to describe; ``None`` describes every open file.

        Returns
        -------
        JsonObject
            Every recognized picture of the files with its kept detections or segmented instances; empty for a
            classification.

        Raises
        ------
        KeyError
            If a file is not open.
        """
        catalog: ResultCatalog | None = workspace.shown_catalog()
        profile: ModelProfile | None = workspace.shown_profile
        review_filter: ReviewFilter = workspace.review_filter
        pictures: list[JsonValue] = []
        open_paths: list[Path] = self._paths_of(workspace, paths)
        if catalog is None or profile is None:
            return self._document(None, pictures)
        for path in open_paths:
            for frame_key in catalog.keys_of(path):
                stored: StoredResult | None = catalog.stored_of(frame_key)
                if stored is None or stored.result.class_scores:
                    continue
                passing: frozenset[int] = review_filter.passing_indices(stored.result.findings)
                kept: list[int] = [
                    index
                    for index in range(len(stored.result.instances))
                    if stored.is_accepted(index) and index in passing
                ]
                pictures.append(self._picture(frame_key, stored.result, kept))
        return self._document(profile.label, pictures)

    @staticmethod
    def _paths_of(workspace: Workspace, paths: Iterable[Path] | None) -> list[Path]:
        if paths is None:
            return [item.path for item in workspace.media]
        return [workspace.media_item(path).path for path in paths]

    def _document(self, model_label: str | None, pictures: list[JsonValue]) -> JsonObject:
        return {
            "format": self.FORMAT_NAME,
            "version": self.FORMAT_VERSION,
            "model": model_label,
            "coordinate_space": self.COORDINATE_SPACE,
            "pictures": pictures,
        }

    def _picture(self, frame_key: FrameKey, result: FrameResult, indices: Iterable[int]) -> JsonObject:
        return {
            "path": str(frame_key.path),
            "frame": frame_key.frame_index,
            "width": result.image_size.width,
            "height": result.image_size.height,
            "objects": [self._object(index, result.instances[index]) for index in indices],
        }

    @staticmethod
    def _object(index: int, instance: RecognizedInstance) -> JsonObject:
        polygons: list[JsonValue] = (
            [] if instance.mask is None else [[[x, y] for x, y in polygon] for polygon in instance.mask.polygons()]
        )
        return {
            "index": index,
            "class_name": instance.class_name,
            "source": instance.query_label,
            "confidence": instance.confidence,
            "box": list[JsonValue](instance.box.xyxy),
            "area": instance.area,
            "polygons": polygons,
        }
