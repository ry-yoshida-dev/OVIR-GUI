from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

import numpy as np

from ..media import FrameKey
from ..models import ClassificationModel, ModelProfile, ProfileOption
from ..prompting import PromptSignature, QueriedClass, QueryKind, ReferenceBox, ReferenceImage
from ..recognition import (
    ClassifierLogits,
    ClassScore,
    EmbeddingLogit,
    FrameResult,
    ImageSize,
    InstanceMask,
    LabelMode,
    PixelBox,
    RecognitionTask,
    RecognizedInstance,
)
from ..recognition.array_types import UInt8Array
from ..results import ResultLibrary, StoredResult
from .json_fields import JsonFields, JsonValue
from .media_stamp import MediaStamp
from .picture_prompt_codec import PicturePromptCodec
from .restored_results import RestoredResults
from .results_manifest_writer import ResultsManifestWriter


class ResultsManifestReader:
    """
    Rebuilds a ``ResultLibrary`` from a manifest written by ``ResultsManifestWriter`` and its mask bits.

    Results of media files that changed since (other modification time or size) are dropped; results of media files
    that cannot be reached now, such as ones on a disconnected drive, are kept with their stored stamp.
    Rejections of classifications in a version 1 manifest, which indexed the best class by 0, are moved to the
    position of that class. Classifications of a manifest before version 3 have no logits, so they keep the scores
    they were stored with; version 3 named the logits of the sentences ``"sentences"``.
    """

    CLASS_INDEXED_VERSION: ClassVar[int] = 2
    SENTENCES_KEY: ClassVar[str] = "sentences"

    def __init__(self, mask_bits: Sequence[UInt8Array]) -> None:
        """
        Parameters
        ----------
        mask_bits : Sequence[UInt8Array]
            Packed bits of every mask, indexed by the instances.
        """
        self._mask_bits: Sequence[UInt8Array] = mask_bits

    def read(self, manifest: dict[str, JsonValue]) -> RestoredResults:
        """
        Rebuild the stored results.

        Parameters
        ----------
        manifest : dict[str, JsonValue]
            Parsed manifest.

        Returns
        -------
        RestoredResults
            Results of every profile for the unchanged and unreachable media files, with the stamps of the
            unreachable ones.

        Raises
        ------
        ValueError
            If the manifest is of another format or version, or its content is invalid.
        TypeError
            If a field has the wrong type.
        """
        if manifest.get("format") != ResultsManifestWriter.FORMAT_NAME:
            raise ValueError("the file is not an OVIR GUI results archive.")
        version: JsonValue = manifest.get("version")
        if not isinstance(version, int) or version > ResultsManifestWriter.FORMAT_VERSION:
            raise ValueError(f"unsupported results archive version {version!r}.")
        unreachable_media: dict[Path, MediaStamp] = {}
        media_paths: list[Path | None] = [
            self._valid_media_path(JsonFields.object_of(entry, "media"), unreachable_media)
            for entry in JsonFields.list_of(manifest.get("media"), "media")
        ]
        signatures: list[PromptSignature] = [
            self._signature_of(JsonFields.object_of(entry, "signature"))
            for entry in JsonFields.list_of(manifest.get("signatures"), "signatures")
        ]
        library: ResultLibrary = ResultLibrary()
        for entry in JsonFields.list_of(manifest.get("profiles"), "profiles"):
            profile_entry: dict[str, JsonValue] = JsonFields.object_of(entry, "profile")
            profile: ModelProfile = self._profile_of(profile_entry)
            catalog = library.add(profile)
            for frame_value in JsonFields.list_of(profile_entry.get("frames"), "frames"):
                frame_entry: dict[str, JsonValue] = JsonFields.object_of(frame_value, "frame")
                media_index: int = JsonFields.integer_of(frame_entry.get("media"), "media")
                if not 0 <= media_index < len(media_paths):
                    raise ValueError(f"frame media must index media. got {media_index}")
                path: Path | None = media_paths[media_index]
                if path is None:
                    continue
                frame_value_index: JsonValue = frame_entry.get("frame")
                frame_key: FrameKey = FrameKey(
                    path,
                    None if frame_value_index is None else JsonFields.integer_of(frame_value_index, "frame"),
                )
                signature_index: int = JsonFields.integer_of(frame_entry.get("signature"), "signature")
                if not 0 <= signature_index < len(signatures):
                    raise ValueError(f"frame signature must index signatures. got {signature_index}")
                result: FrameResult = self._result_of(profile, frame_entry)
                rejected: frozenset[int] = frozenset(
                    JsonFields.integer_of(index, "rejected")
                    for index in JsonFields.list_of(frame_entry.get("rejected", []), "rejected")
                )
                if result.class_scores and version < self.CLASS_INDEXED_VERSION:
                    rejected = self._class_indexed(result, rejected)
                catalog.restore(
                    frame_key,
                    StoredResult(result=result, signature=signatures[signature_index], rejected_indices=rejected),
                )
        return RestoredResults(library=library, unreachable_media=unreachable_media)

    @staticmethod
    def _valid_media_path(entry: dict[str, JsonValue], unreachable_media: dict[Path, MediaStamp]) -> Path | None:
        path: Path = Path(JsonFields.string_of(entry.get("path"), "media path"))
        stored: MediaStamp = MediaStamp(
            mtime_ns=JsonFields.integer_of(entry.get("mtime_ns"), "mtime_ns"),
            size=JsonFields.integer_of(entry.get("size"), "size"),
        )
        current: MediaStamp | None = MediaStamp.of(path)
        if current is None:
            unreachable_media[path] = stored
            return path
        return path if current == stored else None

    @staticmethod
    def _profile_of(entry: dict[str, JsonValue]) -> ModelProfile:
        options: list[ProfileOption] = []
        for option_value in JsonFields.list_of(entry.get("options"), "options"):
            pair: list[JsonValue] = JsonFields.list_of(option_value, "option")
            if len(pair) != 2:
                raise ValueError(f"an option needs a name and a value. got {pair}")
            options.append(
                ProfileOption(JsonFields.string_of(pair[0], "option"), JsonFields.string_of(pair[1], "option"))
            )
        return ModelProfile(
            task=RecognitionTask(JsonFields.string_of(entry.get("task"), "task")),
            backend=JsonFields.string_of(entry.get("backend"), "backend"),
            model_name=JsonFields.string_of(entry.get("model"), "model"),
            weights_path=JsonFields.string_of(entry.get("weights"), "weights"),
            device=JsonFields.string_of(entry.get("device"), "device"),
            precision=JsonFields.string_of(entry.get("precision"), "precision"),
            options=tuple(options),
            query_kinds=frozenset(
                QueryKind(JsonFields.string_of(kind, "query kind"))
                for kind in JsonFields.list_of(entry.get("query_kinds", ["text"]), "query_kinds")
            ),
            is_sequential=JsonFields.boolean_of(entry.get("is_sequential", False), "is_sequential"),
        )

    @staticmethod
    def _signature_of(entry: dict[str, JsonValue]) -> PromptSignature:
        classes: list[QueriedClass] = []
        for class_value in JsonFields.list_of(entry.get("classes"), "classes"):
            class_entry: dict[str, JsonValue] = JsonFields.object_of(class_value, "class")
            name: str = JsonFields.string_of(class_entry.get("name"), "class name")
            boxes: list[ReferenceBox] = []
            for box_value in JsonFields.list_of(class_entry.get("boxes", []), "boxes"):
                box_entry: dict[str, JsonValue] = JsonFields.object_of(box_value, "box")
                corners: list[float] = [
                    JsonFields.number_of(corner, "corner")
                    for corner in JsonFields.list_of(box_entry.get("xyxy"), "xyxy")
                ]
                if len(corners) != 4:
                    raise ValueError(f"a reference box needs 4 corners. got {corners}")
                boxes.append(
                    ReferenceBox(
                        reference_image=ReferenceImage(
                            name=JsonFields.string_of(box_entry.get("image"), "image"),
                            digest=JsonFields.string_of(box_entry.get("digest"), "digest"),
                        ),
                        class_name=name,
                        left=corners[0],
                        top=corners[1],
                        right=corners[2],
                        bottom=corners[3],
                    )
                )
            classes.append(
                QueriedClass(
                    name=name,
                    phrases=frozenset(
                        JsonFields.string_of(phrase, "phrase")
                        for phrase in JsonFields.list_of(class_entry.get("phrases"), "phrases")
                    ),
                    reference_boxes=frozenset(boxes),
                    exemplar_boxes=frozenset(
                        PicturePromptCodec.exemplar_of(value)
                        for value in JsonFields.list_of(class_entry.get("exemplars", []), "exemplars")
                    ),
                    object_marks=frozenset(
                        PicturePromptCodec.mark_of(value)
                        for value in JsonFields.list_of(class_entry.get("marks", []), "marks")
                    ),
                )
            )
        return PromptSignature(tuple(classes))

    @staticmethod
    def _class_indexed(result: FrameResult, rejected: frozenset[int]) -> frozenset[int]:
        if 0 not in rejected:
            return frozenset()
        return frozenset({result.findings_of(LabelMode.SINGLE_LABEL)[0].index})

    def _result_of(self, profile: ModelProfile, entry: dict[str, JsonValue]) -> FrameResult:
        task: RecognitionTask = profile.task
        size: list[JsonValue] = JsonFields.list_of(entry.get("size"), "size")
        if len(size) != 2:
            raise ValueError(f"size needs a width and a height. got {size}")
        image_size: ImageSize = ImageSize(
            width=JsonFields.integer_of(size[0], "width"), height=JsonFields.integer_of(size[1], "height")
        )
        if task is RecognitionTask.CLASSIFICATION:
            scores: list[ClassScore] = []
            for score_value in JsonFields.list_of(entry.get("scores"), "scores"):
                fields: list[JsonValue] = JsonFields.list_of(score_value, "score")
                if len(fields) not in (4, 5, 6):
                    raise ValueError(f"a score needs 4 to 6 fields. got {fields}")
                similarity: JsonValue = fields[4] if len(fields) >= 5 else None
                template: JsonValue = fields[5] if len(fields) == 6 else None
                scores.append(
                    ClassScore(
                        class_name=JsonFields.string_of(fields[0], "class"),
                        score=JsonFields.number_of(fields[1], "score"),
                        logit=JsonFields.number_of(fields[2], "logit"),
                        matched_prompt=None if fields[3] is None else JsonFields.string_of(fields[3], "matched prompt"),
                        similarity=None if similarity is None else JsonFields.number_of(similarity, "similarity"),
                        matched_template=None if template is None else JsonFields.string_of(template, "template"),
                    )
                )
            logits_value: JsonValue = entry.get("logits")
            return FrameResult(
                task=task,
                image_size=image_size,
                class_scores=tuple(scores),
                native_label_mode=ClassificationModel.native_label_mode_of(profile.backend),
                embedding_logits=None
                if logits_value is None
                else self._logits_of(
                    JsonFields.object_of(logits_value, "logits"), tuple(score.class_name for score in scores)
                ),
            )
        return FrameResult(
            task=task,
            image_size=image_size,
            instances=tuple(
                self._instance_of(JsonFields.list_of(value, "instance"))
                for value in JsonFields.list_of(entry.get("instances"), "instances")
            ),
        )

    @classmethod
    def _logits_of(cls, entry: dict[str, JsonValue], class_names: tuple[str, ...]) -> ClassifierLogits:
        embeddings_value: JsonValue = entry.get("embeddings", entry.get(cls.SENTENCES_KEY))
        embeddings: list[EmbeddingLogit] = []
        for embedding_value in JsonFields.list_of(embeddings_value, "embeddings"):
            fields: list[JsonValue] = JsonFields.list_of(embedding_value, "embedding")
            if len(fields) != 4:
                raise ValueError(f"a text vector needs 4 fields. got {fields}")
            embeddings.append(
                EmbeddingLogit(
                    class_index=JsonFields.integer_of(fields[0], "vector class"),
                    prompt_index=None if fields[1] is None else JsonFields.integer_of(fields[1], "vector prompt"),
                    template=None if fields[2] is None else JsonFields.string_of(fields[2], "template"),
                    logit=JsonFields.number_of(fields[3], "logit"),
                )
            )
        return ClassifierLogits(
            class_names=class_names,
            prompt_labels=tuple(
                JsonFields.string_of(label, "prompt") for label in JsonFields.list_of(entry.get("prompts"), "prompts")
            ),
            embeddings=tuple(embeddings),
            logit_scale=JsonFields.number_of(entry.get("scale"), "scale"),
            logit_bias=JsonFields.number_of(entry.get("bias"), "bias"),
        )

    def _instance_of(self, fields: list[JsonValue]) -> RecognizedInstance:
        if len(fields) < 5:
            raise ValueError(f"an instance needs at least 5 fields. got {fields}")
        corners: list[float] = [
            JsonFields.number_of(corner, "corner") for corner in JsonFields.list_of(fields[3], "box")
        ]
        mask_index: int = JsonFields.integer_of(fields[4], "mask")
        mask: InstanceMask | None = None
        if mask_index >= 0:
            if mask_index >= len(self._mask_bits) or len(fields) < 6:
                raise ValueError(f"mask {mask_index} is missing.")
            crop: list[int] = [
                JsonFields.integer_of(value, "mask crop") for value in JsonFields.list_of(fields[5], "crop")
            ]
            if len(crop) != 5:
                raise ValueError(f"a mask crop needs 5 numbers. got {crop}")
            mask = InstanceMask(
                left=crop[0],
                top=crop[1],
                width=crop[2],
                height=crop[3],
                packed_bits=np.asarray(self._mask_bits[mask_index], dtype=np.uint8),
                area=crop[4],
            )
        return RecognizedInstance(
            class_name=JsonFields.string_of(fields[0], "class"),
            matched_prompt=JsonFields.string_of(fields[1], "matched prompt"),
            confidence=JsonFields.number_of(fields[2], "confidence"),
            box=PixelBox.of(corners),
            mask=mask,
        )
