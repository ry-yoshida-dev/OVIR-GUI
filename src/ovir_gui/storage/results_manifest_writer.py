import os
from pathlib import Path
from typing import ClassVar

from ..media import FrameKey
from ..models import ModelProfile
from ..prompting import PromptSignature, QueriedClass, ReferenceBox
from ..recognition import FrameResult, InstanceMask, RecognizedInstance
from ..recognition.array_types import UInt8Array
from ..results import ResultCatalog, ResultLibrary, StoredResult
from .json_fields import JsonValue
from .picture_prompt_codec import PicturePromptCodec
from .results_snapshot import ResultsSnapshot


class ResultsManifestWriter:
    """
    Converts a ``ResultLibrary`` into a ``ResultsSnapshot``: a JSON manifest and the packed bits of every mask.

    Prompt signatures shared by many pictures are written once and referenced by index. Each media file is recorded
    with its modification time and size, so results of files changed since are dropped when read back.

    The manifest looks like::

        {
          "format": "ovir-gui-results", "version": 2,
          "media": [{"path": "/data/a.mp4", "mtime_ns": 1, "size": 2}],
          "signatures": [{"classes": [{"name": "car", "phrases": ["car"], "boxes": [...]}]}],
          "profiles": [{"task": "detection", ..., "frames": [
            {"media": 0, "frame": 30, "size": [1280, 720], "signature": 0, "rejected": [1],
             "instances": [["car", "car", 0.8, [10, 20, 200, 120], -1]]}
          ]}]
        }

    A classification frame holds ``"scores": [[class, score, logit, matched prompt, similarity], ...]`` instead of
    instances, ``similarity`` being ``null`` or left out for results stored before it was recorded. Rejected findings
    are indexed by the position of their class score or instance; version 1 indexed the only finding of a
    classification, its best class, by 0. The last
    field of an instance indexes ``mask_bits`` (``-1`` without a mask) and is followed by the crop
    ``[left, top, width, height, area]`` of the mask.
    """

    FORMAT_NAME: ClassVar[str] = "ovir-gui-results"
    FORMAT_VERSION: ClassVar[int] = 2

    def __init__(self) -> None:
        self._media_indices: dict[Path, int] = {}
        self._media_entries: list[JsonValue] = []
        self._signature_indices: dict[PromptSignature, int] = {}
        self._signature_entries: list[JsonValue] = []
        self._mask_bits: list[UInt8Array] = []

    def snapshot(self, library: ResultLibrary) -> ResultsSnapshot:
        """
        Convert every stored result.

        Parameters
        ----------
        library : ResultLibrary
            Results of every profile.

        Returns
        -------
        ResultsSnapshot
            Manifest and mask bits; results of files that no longer exist are left out.
        """
        profiles: list[JsonValue] = [
            self._profile_entry(profile, library.catalog_of(profile)) for profile in library.profiles
        ]
        return ResultsSnapshot(
            manifest={
                "format": self.FORMAT_NAME,
                "version": self.FORMAT_VERSION,
                "media": self._media_entries,
                "signatures": self._signature_entries,
                "profiles": profiles,
            },
            mask_bits=tuple(self._mask_bits),
        )

    def _profile_entry(self, profile: ModelProfile, catalog: ResultCatalog) -> JsonValue:
        frames: list[JsonValue] = []
        for frame_key in catalog.frame_keys:
            stored: StoredResult | None = catalog.stored_of(frame_key)
            media_index: int | None = self._media_index_of(frame_key.path)
            if stored is None or media_index is None:
                continue
            frames.append(self._frame_entry(frame_key, media_index, stored))
        return {
            "task": profile.task.value,
            "backend": profile.backend,
            "model": profile.model_name,
            "weights": profile.weights_path,
            "device": profile.device,
            "precision": profile.precision,
            "options": [[option.name, option.value] for option in profile.options],
            "query_kinds": list[JsonValue](sorted(kind.value for kind in profile.query_kinds)),
            "is_sequential": profile.is_sequential,
            "frames": frames,
        }

    def _frame_entry(self, frame_key: FrameKey, media_index: int, stored: StoredResult) -> JsonValue:
        result: FrameResult = stored.result
        entry: dict[str, JsonValue] = {
            "media": media_index,
            "frame": frame_key.frame_index,
            "size": [result.image_size.width, result.image_size.height],
            "signature": self._signature_index_of(stored.signature),
            "rejected": list[JsonValue](sorted(stored.rejected_indices)),
        }
        if result.class_scores:
            entry["scores"] = [
                [score.class_name, score.score, score.logit, score.matched_prompt, score.similarity]
                for score in result.class_scores
            ]
        else:
            entry["instances"] = [self._instance_entry(instance) for instance in result.instances]
        return entry

    def _instance_entry(self, instance: RecognizedInstance) -> JsonValue:
        fields: list[JsonValue] = [
            instance.class_name,
            instance.matched_prompt,
            instance.confidence,
            list(instance.box.xyxy),
        ]
        mask: InstanceMask | None = instance.mask
        if mask is None:
            fields.append(-1)
            return fields
        fields.append(len(self._mask_bits))
        fields.append([mask.left, mask.top, mask.width, mask.height, mask.area])
        self._mask_bits.append(mask.packed_bits)
        return fields

    def _media_index_of(self, path: Path) -> int | None:
        if path in self._media_indices:
            return self._media_indices[path]
        try:
            status: os.stat_result = path.stat()
        except OSError:
            return None
        self._media_indices[path] = len(self._media_entries)
        self._media_entries.append({"path": str(path), "mtime_ns": status.st_mtime_ns, "size": status.st_size})
        return self._media_indices[path]

    def _signature_index_of(self, signature: PromptSignature) -> int:
        if signature not in self._signature_indices:
            self._signature_indices[signature] = len(self._signature_entries)
            self._signature_entries.append(
                {"classes": [self._class_entry(queried_class) for queried_class in signature.classes]}
            )
        return self._signature_indices[signature]

    @staticmethod
    def _class_entry(queried_class: QueriedClass) -> JsonValue:
        boxes: list[ReferenceBox] = sorted(
            queried_class.reference_boxes, key=lambda box: (box.reference_image.digest, box.xyxy)
        )
        entry: dict[str, JsonValue] = {
            "name": queried_class.name,
            "phrases": list[JsonValue](sorted(queried_class.phrases)),
            "boxes": [
                {"image": box.reference_image.name, "digest": box.reference_image.digest, "xyxy": list(box.xyxy)}
                for box in boxes
            ],
        }
        if queried_class.exemplar_boxes:
            entry["exemplars"] = [
                PicturePromptCodec.exemplar_entry(box)
                for box in sorted(
                    queried_class.exemplar_boxes, key=lambda box: (box.frame_key.sort_key(), box.xyxy, box.is_positive)
                )
            ]
        if queried_class.object_marks:
            entry["marks"] = [
                PicturePromptCodec.mark_entry(mark)
                for mark in sorted(
                    queried_class.object_marks, key=lambda mark: (mark.frame_key.sort_key(), mark.object_id)
                )
            ]
        return entry
