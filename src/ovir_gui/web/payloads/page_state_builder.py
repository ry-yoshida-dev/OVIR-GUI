import contextlib
from pathlib import Path

from ...export import ExportReport
from ...media import ClassColors, FrameKey, InferenceMode, MediaItem, MediaKind
from ...models import ClassificationModel, ModelProfile
from ...prompting import FramePrompt, ObjectMark, PicturePrompts
from ...recognition import LabelMode, RecognitionTask
from ...review import DuplicateSuppression, LabelModeChoice
from ...storage import ClassThresholdStore
from ...workspace import MediaStatus, RunProgress, Workspace
from ..json_value import JsonObject, JsonValue
from ..picture_info import PictureInfo
from ..picture_preview_cache import PicturePreviewCache
from .class_view_builder import ClassViewBuilder
from .marked_object import MarkedObject
from .model_panel_builder import ModelPanelBuilder
from .result_view_builder import ResultViewBuilder


class PageStateBuilder:
    """
    JSON document of everything the page shows except result lists: open media, the shown picture with its drawings,
    task and model settings, profiles, classes, review settings, progress and status.
    """

    def __init__(
        self,
        preview_cache: PicturePreviewCache,
        model_panel: ModelPanelBuilder,
        class_views: ClassViewBuilder,
        result_views: ResultViewBuilder,
    ) -> None:
        """
        Parameters
        ----------
        preview_cache : PicturePreviewCache
            Cache reading image sizes and versions.
        model_panel : ModelPanelBuilder
            Builder of the model settings.
        class_views : ClassViewBuilder
            Builder of the classes and review settings.
        result_views : ResultViewBuilder
            Builder of the profile list.
        """
        self._preview_cache: PicturePreviewCache = preview_cache
        self._model_panel: ModelPanelBuilder = model_panel
        self._class_views: ClassViewBuilder = class_views
        self._result_views: ResultViewBuilder = result_views

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
        statuses: dict[Path, MediaStatus] = workspace.read_model.media_statuses()
        background_key: FrameKey | None = workspace.jobs.background_key
        compared: ModelProfile | None = workspace.compared_profile
        shown: ModelProfile | None = workspace.shown_profile
        palette: list[JsonValue] = list(ClassColors.HEX_COLORS)
        return {
            "media": [self._media_entry(item, statuses[item.path]) for item in workspace.media],
            "current": self._current(workspace),
            "picture_prompt": self._picture_prompt(workspace),
            "background_key": None if background_key is None else self._key(background_key),
            "task": self._task(workspace),
            "model": self._model_panel.model(workspace),
            "profiles": [self._result_views.profile(summary) for summary in workspace.read_model.profile_summaries()],
            "shown_profile_key": None if shown is None else shown.key,
            "compared_profile_key": None if compared is None else compared.key,
            "classes": self._class_views.classes(workspace.workbench),
            "class_set": self._class_views.class_set_state(workspace.workbench),
            "thresholds": self._class_views.thresholds(workspace.review.class_thresholds),
            "suppression": self._class_views.suppression(workspace.review.duplicate_suppression),
            "standard_minimum": ClassThresholdStore.default_minimum_of(workspace.task),
            "standard_overlap_threshold": DuplicateSuppression.DEFAULT_OVERLAP_THRESHOLD,
            "label_mode": self._label_mode(workspace.review.label_mode, shown),
            "status": {"message": workspace.notifier.status_message, "serial": workspace.notifier.status_serial},
            "activity": workspace.notifier.activity_message,
            "summary": workspace.summary,
            "progress": self._progress(workspace.progress),
            "background_progress": self._progress(workspace.jobs.background_progress),
            "is_busy": workspace.is_busy,
            "inference": {
                "mode": workspace.inference_mode.value,
                "is_auto": workspace.is_auto_inference,
                "modes": [{"value": mode.value, "label": mode.label} for mode in InferenceMode],
                "pause_reason": workspace.jobs.background_pause_reason if workspace.is_auto_inference else None,
                "is_following_playback": workspace.jobs.is_following_playback,
            },
            "sampling": {"frame_step": workspace.sampling.frame_step},
            "last_export": self._export_report(workspace.exports.last_export),
            "palette": palette,
            "upload_directory": str(workspace.stores.upload_store.directory),
            "accepted_suffixes": list(MediaKind.accepted_suffixes()),
        }

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
            with contextlib.suppress(OSError):
                version = self._preview_cache.version_of(item.path)
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
            "playback": workspace.playback.state_of(item.path).value,
            "timestamp": None
            if item.video is None or frame_key.frame_index is None
            else item.video.timestamp_of(frame_key.frame_index),
            "is_sampled": frame_key.frame_index is None or workspace.sampling.is_sampled(frame_key.frame_index),
        }

    @staticmethod
    def _label_mode(choice: LabelModeChoice, shown: ModelProfile | None) -> JsonObject:
        native: LabelMode | None = (
            ClassificationModel.native_label_mode_of(shown.backend)
            if shown is not None and shown.task is RecognitionTask.CLASSIFICATION
            else None
        )
        return {
            "choice": choice.value,
            "native": None if native is None else native.value,
            "modes": [{"value": mode.value, "title": mode.title} for mode in LabelMode],
        }

    @staticmethod
    def _task(workspace: Workspace) -> JsonObject:
        return {
            "value": workspace.task.value,
            "options": [{"value": task.value, "title": task.title} for task in workspace.models.model_selector.tasks],
        }

    @staticmethod
    def _picture_prompt(workspace: Workspace) -> JsonValue:
        frame_key: FrameKey | None = workspace.current_key
        if frame_key is None:
            return None
        prompts: PicturePrompts = workspace.workbench.picture_board.prompts
        drawn: FramePrompt = prompts.of(frame_key)
        media_marks: tuple[ObjectMark, ...] = prompts.of_media(frame_key.path).marks
        objects: dict[int, MarkedObject] = {}
        for mark in media_marks:
            marked: MarkedObject = objects.setdefault(mark.object_id, MarkedObject(mark.class_name))
            marked.frame_indices.append(mark.frame_key.frame_index)
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
                {
                    "object_id": object_id,
                    "class_name": marked.class_name,
                    "frames": list[JsonValue](marked.frame_indices),
                }
                for object_id, marked in sorted(objects.items())
            ],
            "next_object_id": workspace.workbench.picture_board.next_object_id(frame_key.path),
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
