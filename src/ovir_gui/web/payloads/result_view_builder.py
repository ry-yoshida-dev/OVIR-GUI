from pathlib import Path

from ...media import ClassColors, FrameKey, MediaItem, VideoInfo
from ...models import MaskGenerationModel, ModelProfile
from ...prompting import PromptChange
from ...recognition import Finding, FrameResult, RecognizedInstance
from ...results import ProfileSummary, ResultCatalog, StoredResult
from ...review import ClassThresholds, ReviewFilter
from ...workspace import Workspace
from ..json_value import JsonObject, JsonValue
from .frame_view_context import FrameViewContext


class ResultViewBuilder:
    """
    JSON documents of the stored results: findings over a picture or a playing video, the result table, the
    timeline of a video and the profile list.

    Pictures are named by ``path`` and ``frame`` (``null`` for an image). Boxes and mask outlines are in pixels of the
    full upright picture.
    """

    def frame(self, workspace: Workspace, path: Path, frame_index: int | None) -> JsonObject:
        """
        Findings shown over one picture with the shown and the compared profile.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.
        path : Path
            Open file.
        frame_index : int | None
            Frame of a video.

        Returns
        -------
        JsonObject
            Picture size, the recognized frame whose result is shown, findings with mask outlines, class scores and
            the compared findings.

        Raises
        ------
        KeyError
            If the file is not open.
        """
        item: MediaItem = workspace.media_item(path)
        return self._frame_of(FrameViewContext.of(workspace), path, item.key_at(frame_index))

    def video_frames(
        self, workspace: Workspace, path: Path, after_frame: int | None = None, until_frame: int | None = None
    ) -> JsonObject:
        """
        Findings of every recognized frame of a video, drawn over the video while it plays in the browser.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.
        path : Path
            Open video.
        after_frame : int | None, optional
            Only frames after this one, so a browser following a running recognition fetches what is new; from the
            first frame when absent.
        until_frame : int | None, optional
            Only frames up to this one; to the last frame when absent.

        Returns
        -------
        JsonObject
            The payload of ``frame`` for each recognized frame, in frame order.

        Raises
        ------
        KeyError
            If the file is not open.
        ValueError
            If the file is not a video.
        """
        item: MediaItem = workspace.media_item(path)
        item.require_video()
        context: FrameViewContext = FrameViewContext.of(workspace)
        catalog: ResultCatalog | None = context.shown_catalog
        frame_indices: list[int] = [] if catalog is None else catalog.frame_indices_of(path)
        first_frame: int = -1 if after_frame is None else after_frame
        frame_indices = [
            frame_index
            for frame_index in frame_indices
            if frame_index > first_frame and (until_frame is None or frame_index <= until_frame)
        ]
        return {
            "path": str(path),
            "frames": [self._frame_of(context, path, item.key_at(frame_index)) for frame_index in frame_indices],
        }

    def results(self, workspace: Workspace) -> JsonObject:
        """
        Every recognized picture of the open media with its findings, for the result table.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.

        Returns
        -------
        JsonObject
            Profile key, task and pictures in media and frame order. A classified picture carries every class score
            from best to worst, each telling whether it reaches the minimum of its class.
        """
        catalog: ResultCatalog | None = workspace.read_model.shown_catalog()
        profile: ModelProfile | None = workspace.shown_profile
        if catalog is None or profile is None:
            return {"profile_key": None, "task": workspace.task.value, "pictures": []}
        review_filter: ReviewFilter = workspace.review.review_filter
        thresholds: ClassThresholds = review_filter.thresholds
        recognized: tuple[FrameKey, ...] = workspace.read_model.recognized_keys(catalog)
        outdated: dict[FrameKey, PromptChange] = workspace.read_model.outdated_keys(profile, recognized)
        pictures: list[JsonValue] = []
        for frame_key in recognized:
            stored: StoredResult | None = catalog.stored_of(frame_key)
            if stored is None:
                continue
            item: MediaItem = workspace.media_item(frame_key.path)
            change: PromptChange | None = outdated.get(frame_key)
            pictures.append(
                {
                    "path": str(frame_key.path),
                    "name": frame_key.path.name,
                    "frame": frame_key.frame_index,
                    "seconds": item.seconds_at(frame_key),
                    "outdated": None if change is None else change.description,
                    "scores": [
                        {
                            "class_name": score.class_name,
                            "score": score.score,
                            "is_reaching_minimum": thresholds.is_reaching_minimum(
                                score.class_name, score.matched_prompt, score.score
                            ),
                        }
                        for score in stored.result.ranked_scores
                    ],
                    "findings": self._finding_entries(stored, review_filter),
                }
            )
        return {"profile_key": profile.key, "task": profile.task.value, "pictures": pictures}

    @staticmethod
    def timeline(workspace: Workspace, path: Path) -> JsonObject:
        """
        Kept findings of every class over the recognized frames of a video.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.
        path : Path
            Open video.

        Returns
        -------
        JsonObject
            Frame count, frame rate, recognized frames and, per class, the kept finding count (or the score for
            classification) at each recognized frame.

        Raises
        ------
        KeyError
            If the file is not open.
        ValueError
            If the file is not a video.
        """
        video: VideoInfo = workspace.media_item(path).video_info
        catalog: ResultCatalog | None = workspace.read_model.shown_catalog()
        frame_indices: list[int] = [] if catalog is None else catalog.frame_indices_of(path)
        review_filter: ReviewFilter = workspace.review.review_filter
        colors: dict[str, str] = workspace.workbench.class_colors()
        names: list[str] = list(workspace.workbench.class_names)
        values: dict[str, list[float]] = {name: [0.0] * len(frame_indices) for name in names}
        top_classes: list[JsonValue] = []
        for position, frame_index in enumerate(frame_indices):
            stored: StoredResult | None = None if catalog is None else catalog.stored_of(FrameKey(path, frame_index))
            if stored is None:
                top_classes.append(None)
                continue
            result: FrameResult = stored.result
            for name in result.class_names:
                if name not in values:
                    names.append(name)
                    values[name] = [0.0] * len(frame_indices)
            kept: frozenset[int] = stored.kept_indices(review_filter)
            listed: tuple[Finding, ...] = review_filter.findings_of(result)
            if result.class_scores:
                for score in result.class_scores:
                    values[score.class_name][position] = score.score
                top_classes.append(next((finding.class_name for finding in listed if finding.index in kept), None))
                continue
            top_classes.append(None)
            for finding in listed:
                if finding.index in kept:
                    values[finding.class_name][position] += 1.0
        return {
            "path": str(path),
            "frame_count": video.frame_count,
            "fps": video.fps,
            "frame_step": workspace.sampling.frame_step,
            "frames": list[JsonValue](frame_indices),
            "top_classes": top_classes,
            "classes": [
                {
                    "name": name,
                    "color": colors.get(name, ClassColors.hex_of(index)),
                    "values": list[JsonValue](values[name]),
                }
                for index, name in enumerate(names)
            ],
        }

    @staticmethod
    def profile(summary: ProfileSummary) -> JsonObject:
        """
        One stored profile of the current task with its progress over the open media.

        Parameters
        ----------
        summary : ProfileSummary
            Profile with its counts.

        Returns
        -------
        JsonObject
            Key, model, options and counts.
        """
        profile: ModelProfile = summary.profile
        return {
            "key": profile.key,
            "task": profile.task.value,
            "backend": profile.backend,
            "model_name": profile.model_name,
            "weights_path": profile.weights_path,
            "device": profile.device,
            "precision": profile.precision,
            "options": [{"name": option.name, "value": option.value} for option in profile.options],
            "options_text": profile.options_text,
            "file_count": summary.file_count,
            "done_file_count": summary.done_file_count,
            "expected_frame_count": summary.expected_frame_count,
            "recognized_frame_count": summary.recognized_frame_count,
            "outdated_count": summary.outdated_count,
            "finding_count": summary.finding_count,
        }

    def _frame_of(self, context: FrameViewContext, path: Path, frame_key: FrameKey) -> JsonObject:
        shown_catalog: ResultCatalog | None = context.shown_catalog
        displayed: FrameKey | None = None if shown_catalog is None else shown_catalog.displayed_key(frame_key)
        stored: StoredResult | None = None
        if shown_catalog is not None and displayed is not None:
            stored = shown_catalog.stored_of(displayed)
        change: PromptChange | None = None if displayed is None else context.change_of(displayed)
        compared_catalog: ResultCatalog | None = context.compared_catalog
        compared_key: FrameKey | None = None if compared_catalog is None else compared_catalog.displayed_key(frame_key)
        compared_result: FrameResult | None = (
            None if compared_catalog is None or compared_key is None else compared_catalog.result_of(compared_key)
        )
        compared_profile: ModelProfile | None = context.compared_profile
        return {
            "path": str(path),
            "frame": frame_key.frame_index,
            "task": context.task.value,
            "result_frame": None if displayed is None else displayed.frame_index,
            "is_recognized": stored is not None,
            "is_exact": displayed == frame_key,
            "outdated": None if change is None or change.is_unchanged else change.description,
            "findings": [] if stored is None else self._frame_findings(stored, context.review_filter),
            "scores": []
            if stored is None
            else [
                {
                    "class_name": score.class_name,
                    "score": score.score,
                    "logit": score.logit,
                    "similarity": score.similarity,
                    "matched_prompt": score.matched_prompt,
                    "matched_template": score.matched_template,
                }
                for score in stored.result.ranked_scores
            ],
            "compared": None
            if compared_profile is None or compared_result is None
            else {
                "model_name": compared_profile.label,
                "findings": [
                    self._instance_entry(index, instance, True, True)
                    for index, instance in enumerate(compared_result.instances)
                ],
                "top_class": compared_result.ranked_scores[0].class_name if compared_result.class_scores else None,
            },
        }

    def _frame_findings(self, stored: StoredResult, review_filter: ReviewFilter) -> list[JsonValue]:
        if stored.result.class_scores:
            return self._finding_entries(stored, review_filter)
        passing: frozenset[int] = review_filter.passing_indices_of(stored.result)
        return [
            self._instance_entry(
                index,
                instance,
                stored.is_accepted(index),
                index in passing,
            )
            for index, instance in enumerate(stored.result.instances)
        ]

    @staticmethod
    def _instance_entry(index: int, instance: RecognizedInstance, is_accepted: bool, is_passing: bool) -> JsonObject:
        polygons: list[JsonValue] = (
            []
            if instance.mask is None
            else [[coordinate for point in polygon for coordinate in point] for polygon in instance.mask.polygons()]
        )
        return {
            "index": index,
            "class_name": instance.class_name,
            "matched_prompt": instance.matched_prompt,
            "matched_template": None,
            "confidence": instance.confidence,
            "box": list[JsonValue](instance.box.xyxy),
            "area": instance.area,
            "is_accepted": is_accepted,
            "is_passing": is_passing,
            "polygons": polygons,
            "color": ClassColors.hex_of(index)
            if instance.class_name == MaskGenerationModel.REGION_CLASS_NAME
            and instance.matched_prompt == MaskGenerationModel.PROMPT_LABEL
            else None,
        }

    @classmethod
    def _finding_entries(cls, stored: StoredResult, review_filter: ReviewFilter) -> list[JsonValue]:
        findings: tuple[Finding, ...] = review_filter.findings_of(stored.result)
        passing: frozenset[int] = review_filter.passing_indices(findings)
        return [cls._finding_entry(finding, stored, finding.index in passing) for finding in findings]

    @staticmethod
    def _finding_entry(finding: Finding, stored: StoredResult, is_passing: bool) -> JsonObject:
        return {
            "index": finding.index,
            "class_name": finding.class_name,
            "matched_prompt": finding.matched_prompt,
            "matched_template": finding.matched_template,
            "confidence": finding.confidence,
            "box": None if finding.box is None else list[JsonValue](finding.box.xyxy),
            "area": finding.area,
            "similarity": finding.similarity,
            "is_accepted": stored.is_accepted(finding.index),
            "is_passing": is_passing,
        }
