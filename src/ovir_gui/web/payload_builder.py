from pathlib import Path

from ..analysis import (
    ClassComparison,
    ClassStatistics,
    ConfidenceHistogram,
    ProfileComparison,
    ResultStatistics,
)
from ..export import ExportFormat, ExportReport, ExportScope
from ..media import ClassColors, FrameKey, MediaItem, MediaKind
from ..models import (
    ClassificationModel,
    ComputeDevice,
    ComputePrecision,
    ConceptTrackingModel,
    DetectionModel,
    MaskGenerationModel,
    ModelProfile,
    ModelSelection,
    ModelSelector,
    ObjectTrackingModel,
    PromptableSegmentationModel,
    RecognitionModel,
    SegmentationMode,
    SegmentationModel,
)
from ..prompting import FramePrompt, ObjectMark, PicturePrompts, PromptChange, QueryKind, ReferenceBoard
from ..recognition import Finding, FrameResult, RecognitionTask, RecognizedInstance
from ..results import ProfileSummary, ResultCatalog, StoredResult
from ..review import ClassThresholds, DuplicateSuppression, ReviewFilter
from ..storage import ClassSet, ClassSetEntry, ClassThresholdStore
from ..workspace import (
    ActionReply,
    BackgroundScope,
    ClassWorkbench,
    ExportPlan,
    MediaStatus,
    RunProgress,
    Workspace,
)
from .json_value import JsonObject, JsonValue
from .picture_info import PictureInfo
from .picture_preview_cache import PicturePreviewCache


class PayloadBuilder:
    """
    JSON documents describing the workspace to the browser.

    Pictures are named by ``path`` and ``frame`` (``null`` for an image). Boxes and mask outlines are in pixels of the
    full upright picture.
    """

    LISTED_SCORE_COUNT: int = 5

    def __init__(self, preview_cache: PicturePreviewCache) -> None:
        """
        Parameters
        ----------
        preview_cache : PicturePreviewCache
            Cache reading image sizes and versions.
        """
        self._preview_cache: PicturePreviewCache = preview_cache

    def state(self, workspace: Workspace) -> JsonObject:
        """
        Everything the page shows except result lists.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.

        Returns
        -------
        JsonObject
            Media, shown picture, task, model settings, profiles, classes, minimums and status.
        """
        statuses: dict[Path, MediaStatus] = workspace.media_statuses()
        background_key: FrameKey | None = workspace.background_key
        compared: ModelProfile | None = workspace.compared_profile
        shown: ModelProfile | None = workspace.shown_profile
        palette: list[JsonValue] = list(ClassColors.HEX_COLORS)
        return {
            "media": [self._media_entry(item, statuses[item.path]) for item in workspace.media],
            "current": self._current(workspace),
            "picture_prompt": self._picture_prompt(workspace),
            "background_key": None if background_key is None else self._key(background_key),
            "task": self._task(workspace),
            "model": self._model(workspace),
            "profiles": [self._profile(summary) for summary in workspace.profile_summaries()],
            "shown_profile_key": None if shown is None else shown.key,
            "compared_profile_key": None if compared is None else compared.key,
            "classes": self._classes(workspace.workbench),
            "class_set": self._class_set_state(workspace.workbench),
            "thresholds": self._thresholds(workspace.class_thresholds),
            "suppression": self._suppression(workspace.duplicate_suppression),
            "standard_minimum": ClassThresholdStore.default_minimum_of(workspace.task),
            "standard_overlap_threshold": DuplicateSuppression.DEFAULT_OVERLAP_THRESHOLD,
            "status": {"message": workspace.status_message, "serial": workspace.status_serial},
            "activity": workspace.activity_message,
            "summary": workspace.summary,
            "progress": self._progress(workspace.progress),
            "is_busy": workspace.is_busy,
            "background": {
                "scope": workspace.background_scope.value,
                "scopes": [{"value": scope.value, "label": scope.label} for scope in BackgroundScope],
                "is_paused": workspace.is_background_paused,
            },
            "sampling": {"frame_step": workspace.sampling.frame_step},
            "last_export": self._export_report(workspace.last_export),
            "palette": palette,
            "upload_directory": str(workspace.stores.upload_store.directory),
            "accepted_suffixes": list(MediaKind.accepted_suffixes()),
        }

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
        frame_key: FrameKey = item.key_at(frame_index)
        review_filter: ReviewFilter = workspace.review_filter
        shown_catalog: ResultCatalog | None = workspace.shown_catalog()
        displayed: FrameKey | None = None if shown_catalog is None else shown_catalog.displayed_key(frame_key)
        stored: StoredResult | None = None
        if shown_catalog is not None and displayed is not None:
            stored = shown_catalog.stored_of(displayed)
        change: PromptChange | None = None if displayed is None else workspace.change_of(displayed)
        compared_catalog: ResultCatalog | None = workspace.compared_catalog()
        compared_key: FrameKey | None = None if compared_catalog is None else compared_catalog.displayed_key(frame_key)
        compared_result: FrameResult | None = (
            None if compared_catalog is None or compared_key is None else compared_catalog.result_of(compared_key)
        )
        compared_profile: ModelProfile | None = workspace.compared_profile
        return {
            "path": str(path),
            "frame": frame_key.frame_index,
            "task": workspace.task.value,
            "result_frame": None if displayed is None else displayed.frame_index,
            "is_recognized": stored is not None,
            "is_exact": displayed == frame_key,
            "outdated": None if change is None or change.is_unchanged else change.description,
            "findings": [] if stored is None else self._frame_findings(stored, review_filter),
            "scores": []
            if stored is None
            else [
                {
                    "class_name": score.class_name,
                    "score": score.score,
                    "logit": score.logit,
                    "query": score.query_label,
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
                "top_class": compared_result.findings[0].class_name if compared_result.class_scores else None,
            },
        }

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
        _ = workspace.media_item(path).video_info
        catalog: ResultCatalog | None = workspace.shown_catalog()
        frame_indices: list[int] = [] if catalog is None else catalog.frame_indices_of(path)
        first_frame: int = -1 if after_frame is None else after_frame
        frame_indices = [
            frame_index
            for frame_index in frame_indices
            if frame_index > first_frame and (until_frame is None or frame_index <= until_frame)
        ]
        return {
            "path": str(path),
            "frames": [self.frame(workspace, path, frame_index) for frame_index in frame_indices],
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
            Profile key, task and pictures in media and frame order. A classified picture carries its best class
            scores from best to worst and the count of every scored class.
        """
        catalog: ResultCatalog | None = workspace.shown_catalog()
        profile: ModelProfile | None = workspace.shown_profile
        if catalog is None or profile is None:
            return {"profile_key": None, "task": workspace.task.value, "pictures": []}
        review_filter: ReviewFilter = workspace.review_filter
        outdated: dict[FrameKey, PromptChange] = workspace.library.outdated_keys(
            profile, workspace.signature_for(profile), workspace.recognized_keys(catalog)
        )
        pictures: list[JsonValue] = []
        for frame_key in workspace.recognized_keys(catalog):
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
                    "seconds": None
                    if item.video is None or frame_key.frame_index is None
                    else item.video.seconds_of(frame_key.frame_index),
                    "outdated": None if change is None else change.description,
                    "scores": [
                        {"class_name": score.class_name, "score": score.score}
                        for score in stored.result.ranked_scores[: self.LISTED_SCORE_COUNT]
                    ],
                    "class_count": len(stored.result.class_scores),
                    "findings": self._finding_entries(stored, review_filter),
                }
            )
        return {"profile_key": profile.key, "task": profile.task.value, "pictures": pictures}

    def timeline(self, workspace: Workspace, path: Path) -> JsonObject:
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
        item: MediaItem = workspace.media_item(path)
        video = item.video_info
        catalog: ResultCatalog | None = workspace.shown_catalog()
        frame_indices: list[int] = [] if catalog is None else catalog.frame_indices_of(path)
        review_filter: ReviewFilter = workspace.review_filter
        colors: dict[str, str] = workspace.class_colors()
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
            passing: frozenset[int] = review_filter.passing_indices(result.findings)
            if result.class_scores:
                for score in result.class_scores:
                    values[score.class_name][position] = score.score
                top: Finding = result.findings[0]
                is_kept: bool = stored.is_accepted(0) and top.index in passing
                top_classes.append(top.class_name if is_kept else None)
                continue
            top_classes.append(None)
            for finding in result.findings:
                if stored.is_accepted(finding.index) and finding.index in passing:
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

    def statistics(self, workspace: Workspace) -> JsonObject:
        """
        Per-class statistics of the shown results and the comparison with another profile.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.

        Returns
        -------
        JsonObject
            Shown model, statistics and comparison; ``null`` parts are not available.
        """
        shown: ModelProfile | None = workspace.shown_profile
        statistics: ResultStatistics | None = workspace.statistics()
        comparison: ProfileComparison | None = workspace.comparison()
        return {
            "model": None if shown is None else shown.label,
            "task": workspace.task.value,
            "statistics": None if statistics is None else self._result_statistics(statistics),
            "comparison": None if comparison is None else self._comparison(comparison),
        }

    def class_set_entries(self, entries: tuple[ClassSetEntry, ...]) -> JsonObject:
        """
        Saved class sets.

        Parameters
        ----------
        entries : tuple[ClassSetEntry, ...]
            Listed sets.

        Returns
        -------
        JsonObject
            Name, save time, class names and description of every set.
        """
        listed: list[JsonValue] = []
        for entry in entries:
            class_names: list[JsonValue] = [] if entry.summary is None else list(entry.summary.class_names)
            listed.append(
                {
                    "name": entry.name,
                    "saved_at": entry.saved_at.isoformat(timespec="seconds"),
                    "is_readable": entry.is_readable,
                    "class_names": class_names,
                    "description": "" if entry.summary is None else entry.summary.description,
                }
            )
        return {"entries": listed}

    def class_set_preview(self, name: str, class_set: ClassSet) -> JsonObject:
        """
        Classes, phrases and image prompts of one saved class set.

        Parameters
        ----------
        name : str
            Set name.
        class_set : ClassSet
            Content of the set.

        Returns
        -------
        JsonObject
            Name and classes with their phrases and reference images.
        """
        board: ReferenceBoard = ReferenceBoard()
        board.replace(class_set.reference_boxes, class_set.reference_pixels)
        return {
            "name": name,
            "classes": [
                self._class(index, definition.name, definition.text_queries, board)
                for index, definition in enumerate(class_set.classes)
            ],
        }

    def export_plan(self, plan: ExportPlan, default_directory: Path) -> JsonObject:
        """
        What an export would write, with the choices of the export dialog.

        Parameters
        ----------
        plan : ExportPlan
            Profile and counts.
        default_directory : Path
            Output directory suggested to the user.

        Returns
        -------
        JsonObject
            Model, counts, issue, formats of the task and scopes.
        """
        return {
            "model_name": plan.profile.label,
            "options_text": plan.profile.options_text,
            "task": plan.profile.task.value,
            "picture_count": plan.picture_count,
            "pending_count": plan.pending_count,
            "issue": plan.issue,
            "formats": [
                {
                    "value": export_format.value,
                    "label": export_format.label,
                    "is_confidence_supported": export_format.is_confidence_supported,
                }
                for export_format in ExportFormat.of_task(plan.profile.task)
            ],
            "scopes": [
                {"value": scope.value, "label": scope.label, "description": scope.description} for scope in ExportScope
            ],
            "default_directory": str(default_directory),
        }

    @staticmethod
    def reply(reply: ActionReply) -> JsonObject:
        """
        Answer to a request.

        Parameters
        ----------
        reply : ActionReply
            Answer of the workspace.

        Returns
        -------
        JsonObject
            Status, message and the classes to approve skipping.
        """
        skipped: list[JsonValue] = list(reply.skipped_class_names)
        return {"status": reply.status.value, "message": reply.message, "skipped_class_names": skipped}

    @staticmethod
    def _key(frame_key: FrameKey) -> JsonObject:
        return {"path": str(frame_key.path), "frame": frame_key.frame_index}

    @staticmethod
    def _media_entry(item: MediaItem, status: MediaStatus) -> JsonObject:
        count_text: str = (
            str(status.kept_count)
            if status.expected_count == 1
            else f"{status.recognized_count}/{status.expected_count}"
        )
        return {
            "path": str(item.path),
            "name": item.path.name,
            "kind": item.kind.value,
            "state": status.state.value,
            "color": status.state.color,
            "count_text": count_text if status.recognized_count or status.outdated_count else "",
            "kept_count": status.kept_count,
            "description": status.description,
            "frame_count": None if item.video is None else item.video.frame_count,
            "fps": None if item.video is None else item.video.fps,
        }

    def _current(self, workspace: Workspace) -> JsonValue:
        frame_key: FrameKey | None = workspace.current_key
        item: MediaItem | None = workspace.current_item
        if frame_key is None or item is None:
            return None
        width: int | None = None
        height: int | None = None
        version: str | None = None
        if item.video is None:
            try:
                info: PictureInfo = self._preview_cache.info_of(item.path)
                width, height, version = info.width, info.height, info.version
            except OSError:
                pass
        else:
            width, height = item.video.size.width, item.video.size.height
            try:
                version = self._preview_cache.version_of(item.path)
            except OSError:
                pass
        return {
            "path": str(item.path),
            "name": item.path.name,
            "kind": item.kind.value,
            "frame": frame_key.frame_index,
            "version": version,
            "width": width,
            "height": height,
            "frame_count": None if item.video is None else item.video.frame_count,
            "fps": None if item.video is None else item.video.fps,
            "playback": workspace.playback_state(item.path).value,
            "timestamp": None
            if item.video is None or frame_key.frame_index is None
            else item.video.timestamp_of(frame_key.frame_index),
            "is_sampled": frame_key.frame_index is None or workspace.sampling.is_sampled(frame_key.frame_index),
        }

    @staticmethod
    def _task(workspace: Workspace) -> JsonObject:
        return {
            "value": workspace.task.value,
            "options": [{"value": task.value, "title": task.title} for task in workspace.model_selector.tasks],
        }

    def _model(self, workspace: Workspace) -> JsonObject:
        selector: ModelSelector = workspace.model_selector
        selection: ModelSelection = workspace.selection
        model: RecognitionModel = workspace.current_model()
        task: RecognitionTask = workspace.task
        backends: list[JsonValue] = []
        for backend in selector.backends_of(task):
            backends.append(
                {
                    "value": backend,
                    "presets": [
                        {"name": preset.name, "label": preset.label} for preset in selector.presets_of(task, backend)
                    ],
                    "image_poolings": list[JsonValue](ClassificationModel.image_poolings_of(backend))
                    if task is RecognitionTask.CLASSIFICATION
                    else [],
                    "is_box_prompted": task is RecognitionTask.SEGMENTATION
                    and SegmentationModel.is_box_prompted_backend(backend),
                    "mode": SegmentationMode.of_backend(backend).value
                    if task is RecognitionTask.SEGMENTATION
                    else None,
                }
            )
        modes: list[JsonValue] = (
            [
                {"value": mode.value, "title": mode.title}
                for mode in dict.fromkeys(
                    SegmentationMode.of_backend(backend) for backend in selector.backends_of(task)
                )
            ]
            if task is RecognitionTask.SEGMENTATION
            else []
        )
        availability = selector.device_availability
        return {
            "backends": backends,
            "modes": modes,
            "mode": SegmentationMode.of_backend(selection.backend).value
            if task is RecognitionTask.SEGMENTATION
            else None,
            "prompt_mode": model.prompt_mode.value,
            "drawing_kinds": [
                kind.value for kind in QueryKind if kind in model.supported_query_kinds and kind.is_drawn_on_picture
            ],
            "is_sequential": model.is_sequential,
            "is_point_supported": not isinstance(model, PromptableSegmentationModel) or model.is_point_supported,
            "tuning": self._tuning(model),
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
            "box_detectors": list[JsonValue](selector.box_detector_labels)
            if task is RecognitionTask.SEGMENTATION
            else [],
            "selection": self._selection(selection),
            "is_image_prompt_supported": QueryKind.VISUAL in model.supported_query_kinds,
            "query_kinds": list[JsonValue](sorted(kind.value for kind in model.supported_query_kinds)),
            "text_templates": list[JsonValue](model.text_templates) if isinstance(model, ClassificationModel) else None,
            "weights_path": model.weights_path,
            "description": self._model_description(model),
        }

    @staticmethod
    def _model_description(model: RecognitionModel) -> str:
        match model:
            case SegmentationModel():
                if model.is_box_prompted:
                    return f"Boxes from {model.box_detector_description}"
                if QueryKind.EXEMPLAR in model.supported_query_kinds:
                    return (
                        "Draw exemplar boxes on a picture to show (+) or exclude (−) a class there; "
                        + "a class without phrases is segmented from its boxes alone."
                    )
                return ""
            case PromptableSegmentationModel():
                if model.is_point_supported:
                    return "Click on an object (right-click excludes a spot) or drag a box around it."
                return "Drag a box around each object; this model takes boxes only."
            case MaskGenerationModel():
                return "Segments every region of the picture; no classes are needed."
            case ObjectTrackingModel():
                return "Mark objects on any frame, then Run Video follows them through the video."
            case ConceptTrackingModel():
                return "Detects every instance of the phrases and follows it through the video."
            case _:
                return ""

    @staticmethod
    def _tuning(model: RecognitionModel) -> JsonObject:
        confidence_label: str | None
        is_nms_shown: bool
        match model:
            case DetectionModel():
                confidence_label, is_nms_shown = None, True
            case SegmentationModel():
                confidence_label, is_nms_shown = None, True
            case PromptableSegmentationModel():
                confidence_label, is_nms_shown = None, False
            case MaskGenerationModel():
                confidence_label, is_nms_shown = "Min IoU", True
            case ObjectTrackingModel():
                confidence_label, is_nms_shown = "Min presence", False
            case ConceptTrackingModel():
                confidence_label, is_nms_shown = "Conf.", False
            case _:
                confidence_label, is_nms_shown = None, False
        return {
            "confidence_label": confidence_label,
            "is_nms_shown": is_nms_shown,
            "is_minimum_confidence_shown": isinstance(
                model, DetectionModel | SegmentationModel | PromptableSegmentationModel
            ),
        }

    @staticmethod
    def _picture_prompt(workspace: Workspace) -> JsonValue:
        frame_key: FrameKey | None = workspace.current_key
        if frame_key is None:
            return None
        prompts: PicturePrompts = workspace.workbench.picture_board.prompts
        drawn: FramePrompt = prompts.of(frame_key)
        media_marks: tuple[ObjectMark, ...] = prompts.of_media(frame_key.path).marks
        objects: dict[int, tuple[str, list[JsonValue]]] = {}
        for mark in media_marks:
            frames: list[JsonValue] = objects.setdefault(mark.object_id, (mark.class_name, []))[1]
            frames.append(mark.frame_key.frame_index)
        return {
            "path": str(frame_key.path),
            "frame": frame_key.frame_index,
            "exemplars": [
                {
                    "index": index,
                    "class_name": box.class_name,
                    "box": list[JsonValue](box.xyxy),
                    "is_positive": box.is_positive,
                }
                for index, box in enumerate(drawn.exemplars)
            ],
            "marks": [
                {
                    "object_id": mark.object_id,
                    "class_name": mark.class_name,
                    "positive_points": [list[JsonValue](point) for point in mark.positive_points],
                    "negative_points": [list[JsonValue](point) for point in mark.negative_points],
                    "box": None if mark.box is None else list[JsonValue](mark.box),
                }
                for mark in drawn.marks
            ],
            "objects": [
                {"object_id": object_id, "class_name": class_name, "frames": frames}
                for object_id, (class_name, frames) in sorted(objects.items())
            ],
            "next_object_id": workspace.workbench.picture_board.next_object_id(frame_key.path),
        }

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
        }

    @staticmethod
    def _profile(summary: ProfileSummary) -> JsonObject:
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

    def _frame_findings(self, stored: StoredResult, review_filter: ReviewFilter) -> list[JsonValue]:
        if stored.result.class_scores:
            return self._finding_entries(stored, review_filter)
        passing: frozenset[int] = review_filter.passing_indices(stored.result.findings)
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
            "query": instance.query_label,
            "confidence": instance.confidence,
            "box": list[JsonValue](instance.box.xyxy),
            "area": instance.area,
            "is_accepted": is_accepted,
            "is_passing": is_passing,
            "polygons": polygons,
            "color": ClassColors.hex_of(index)
            if instance.class_name == MaskGenerationModel.REGION_CLASS_NAME
            and instance.query_label == MaskGenerationModel.QUERY_LABEL
            else None,
        }

    @classmethod
    def _finding_entries(cls, stored: StoredResult, review_filter: ReviewFilter) -> list[JsonValue]:
        findings: tuple[Finding, ...] = stored.result.findings
        passing: frozenset[int] = review_filter.passing_indices(findings)
        return [cls._finding_entry(finding, stored, finding.index in passing) for finding in findings]

    @staticmethod
    def _finding_entry(finding: Finding, stored: StoredResult, is_passing: bool) -> JsonObject:
        return {
            "index": finding.index,
            "class_name": finding.class_name,
            "query": finding.query_label,
            "confidence": finding.confidence,
            "box": None if finding.box is None else list[JsonValue](finding.box.xyxy),
            "area": finding.area,
            "is_accepted": stored.is_accepted(finding.index),
            "is_passing": is_passing,
        }

    def _classes(self, workbench: ClassWorkbench) -> list[JsonValue]:
        board: ReferenceBoard = workbench.reference_board
        return [
            self._class(index, definition.name, definition.text_queries, board)
            for index, definition in enumerate(workbench.classes)
        ]

    @staticmethod
    def _class(index: int, name: str, phrases: tuple[str, ...], board: ReferenceBoard) -> JsonObject:
        references: list[JsonValue] = []
        for reference_image in board.reference_images_of(name):
            width, height = board.pixels_of(reference_image).size
            boxes: list[JsonValue] = [list[JsonValue](box.xyxy) for box in board.boxes_of(name, reference_image)]
            references.append(
                {
                    "name": reference_image.name,
                    "digest": reference_image.digest,
                    "width": width,
                    "height": height,
                    "boxes": boxes,
                }
            )
        return {
            "name": name,
            "color": ClassColors.hex_of(index),
            "phrases": list[JsonValue](phrases),
            "references": references,
        }

    @staticmethod
    def _class_set_state(workbench: ClassWorkbench) -> JsonObject:
        return {
            "name": workbench.class_set_name,
            "is_edited": workbench.is_edited,
            "is_unsaved": workbench.is_unsaved,
            "names": list[JsonValue](workbench.class_set_store.class_set_names),
            "directory": str(workbench.class_set_store.class_set_directory),
        }

    @staticmethod
    def _thresholds(thresholds: ClassThresholds) -> JsonObject:
        class_minimums: JsonObject = dict(thresholds.class_minimums)
        phrase_minimums: JsonObject = {
            class_name: dict[str, JsonValue](by_phrase) for class_name, by_phrase in thresholds.phrase_minimums.items()
        }
        return {
            "default_minimum": thresholds.default_minimum,
            "class_minimums": class_minimums,
            "phrase_minimums": phrase_minimums,
        }

    @staticmethod
    def _suppression(suppression: DuplicateSuppression) -> JsonObject:
        class_overlaps: JsonObject = dict(suppression.class_overlap_thresholds)
        return {
            "is_enabled": suppression.is_enabled,
            "overlap_threshold": suppression.overlap_threshold,
            "class_overlap_thresholds": class_overlaps,
        }

    @staticmethod
    def _progress(progress: RunProgress | None) -> JsonValue:
        if progress is None:
            return None
        return {
            "title": progress.title,
            "processed_count": progress.processed_count,
            "total_count": progress.total_count,
            "is_blocking": progress.is_blocking,
        }

    @staticmethod
    def _export_report(report: ExportReport | None) -> JsonValue:
        if report is None:
            return None
        return {
            "format_name": report.format_name,
            "output_directory": str(report.output_directory),
            "picture_count": report.picture_count,
            "finding_count": report.finding_count,
            "file_count": report.file_count,
        }

    def _result_statistics(self, statistics: ResultStatistics) -> JsonObject:
        return {
            "picture_count": statistics.picture_count,
            "recognized_count": statistics.recognized_count,
            "classes": [self._class_statistics(entry) for entry in statistics.classes],
            "histogram": self._histogram(statistics.histogram),
        }

    def _class_statistics(self, entry: ClassStatistics) -> JsonObject:
        return {
            "class_name": entry.class_name,
            "picture_count": entry.picture_count,
            "finding_count": entry.finding_count,
            "rejected_count": entry.rejected_count,
            "below_minimum_count": entry.below_minimum_count,
            "kept_count": entry.kept_count,
            "mean_confidence": entry.mean_confidence,
            "median_confidence": entry.median_confidence,
            "histogram": self._histogram(entry.histogram),
        }

    @staticmethod
    def _histogram(histogram: ConfidenceHistogram) -> JsonObject:
        return {"bin_counts": list[JsonValue](histogram.bin_counts), "bin_width": histogram.bin_width}

    def _comparison(self, comparison: ProfileComparison) -> JsonObject:
        return {
            "picture_count": comparison.picture_count,
            "iou_threshold": comparison.iou_threshold,
            "classes": [self._class_comparison(entry) for entry in comparison.classes],
        }

    @staticmethod
    def _class_comparison(entry: ClassComparison) -> JsonObject:
        return {
            "class_name": entry.class_name,
            "shown_count": entry.shown_count,
            "compared_count": entry.compared_count,
            "matched_count": entry.matched_count,
            "shown_only_count": entry.shown_only_count,
            "compared_only_count": entry.compared_only_count,
        }
