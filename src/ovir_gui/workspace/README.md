# workspace

## Overview

User-interface-independent application core. `Workspace` is the facade the web routes drive: it opens and shows media, edits the classes (via `ClassWorkbench`) and the settings, and exposes its collaborators for everything else. They share the `WorkingState` (open media and shown picture of the current task, the media kept for the other tasks, shown and compared profiles) and the `RecognitionSettings` (task, model choices, sampling, inference mode) owned by the thread behind a `TaskScheduler`, so no part needs locks:

- `ModelChoice` picks the model of every task and the accepted licenses; `SessionMapper` restores and saves the session.
- `ResultReadModel` answers what the stored results say (statuses, freshness, statistics, comparison); `ReviewSettings` holds the label mode of classifications, the minimums and the duplicate suppression; `ResultProfiles` switches the shown and compared profile and records the user's review.
- `InferenceRunner` starts foreground jobs and background jobs on the `InferenceEngine`, whose single worker thread reports to the `InferenceOutcomeHandler`; `PromptAssembler` builds their prompts and `BackgroundPlanner` chooses what the background recognizes next.
- `ExportCoordinator` plans and writes exports and `PlaybackPreparer` encodes browser-playable video copies, both off the owning thread.
- `StatusNotifier` tells every `WorkspaceObserver` what changed (`WorkspaceTopic`) and keeps the status messages; `DeferredSave` writes the results shortly after changes, never overlapping a write at quit.

The `web` package implements the scheduler and the observer, and `WorkspaceStores` connects the workspace to the `storage` package.

## Components

| Component | Description |
| --- | --- |
| [action_reply.py](./action_reply.py) | `ActionReply` is the answer of the workspace to a request such as Detect, Detect All or Export. |
| [action_status.py](./action_status.py) | `ActionStatus` enumerates how the workspace answered a request of the user. |
| [background_planner.py](./background_planner.py) | `BackgroundPlanner` chooses what to recognize next in the background for the inference mode, frames ahead of a playing video first, and remembers what failed. |
| [class_workbench.py](./class_workbench.py) | `ClassWorkbench` edits the classes of the current task with their phrases and reference images by class id, keeps the exemplar boxes and object marks drawn for them on pictures, and tracks their class set; every task keeps its own. |
| [deferred_save.py](./deferred_save.py) | `DeferredSave` writes one piece of workspace state shortly after it changes, off the owning thread, never overlapping or replacing a newer write. |
| [export_coordinator.py](./export_coordinator.py) | `ExportCoordinator` plans the export of the images or the videos, writes their stored results off the owning thread, leaving out pictures not yet inferred, and gathers what a label preview is written from. |
| [export_plan.py](./export_plan.py) | `ExportPlan` describes what an export of the images or the videos would write now. |
| [export_preview_source.py](./export_preview_source.py) | `ExportPreviewSource` holds what a label preview is written from, gathered on the owning thread. |
| [export_request.py](./export_request.py) | `ExportRequest` is the export chosen by the user. |
| [inference_engine.py](./inference_engine.py) | `InferenceEngine` runs recognition jobs on one worker thread, foreground jobs first and background jobs in between. |
| [inference_job.py](./inference_job.py) | `InferenceJob` holds the pictures to recognize with one model and prompt. |
| [inference_listener.py](./inference_listener.py) | `InferenceListener` receives what the `InferenceEngine` reports, always on the owning thread. |
| [inference_outcome_handler.py](./inference_outcome_handler.py) | `InferenceOutcomeHandler` is the `InferenceListener` of the workspace: it stores recognized results, reports progress and job ends, and continues in the background. |
| [inference_runner.py](./inference_runner.py) | `InferenceRunner` starts foreground jobs at the user's request and background jobs whenever the engine is idle. |
| [job_control.py](./job_control.py) | `JobControl` is shared with the worker and tells whether a job should stop and how far it has come. |
| [job_purpose.py](./job_purpose.py) | `JobPurpose` enumerates why a recognition job runs. |
| [job_summary.py](./job_summary.py) | `JobSummary` describes how a job ended. |
| [media_state.py](./media_state.py) | `MediaState` enumerates how far an open image or video is recognized with the shown model. |
| [media_status.py](./media_status.py) | `MediaStatus` is the recognition state of one open image or video with the shown model. |
| [model_choice.py](./model_choice.py) | `ModelChoice` holds the model chosen for each task with its overrides and the accepted licenses of optional modules. |
| [notice.py](./notice.py) | `Notice` is a message for the user about something that happened, such as a finished run or a failed save. |
| [notice_level.py](./notice_level.py) | `NoticeLevel` enumerates how prominently a notice is shown. |
| [playback_preparer.py](./playback_preparer.py) | `PlaybackPreparer` encodes browser-playable copies of open videos off the owning thread and tells which file to play. |
| [playback_state.py](./playback_state.py) | `PlaybackState` enumerates whether a video has a browser-playable copy. |
| [prompt_assembler.py](./prompt_assembler.py) | `PromptAssembler` builds the prompt of a model from the classes, reference images and drawings, asking approval to skip classes it cannot query. |
| [prompt_preparation.py](./prompt_preparation.py) | `PromptPreparation` holds the prompt built from the classes, or why none could be built. |
| [recognition_settings.py](./recognition_settings.py) | `RecognitionSettings` holds the task, the model of each task, the video sampling and the inference mode remembered in the session. |
| [result_profiles.py](./result_profiles.py) | `ResultProfiles` switches the shown and compared result profile, forgets profiles and records which findings the user keeps. |
| [result_read_model.py](./result_read_model.py) | `ResultReadModel` answers what the stored results say about the open media: statuses, freshness, summaries, statistics and comparison. |
| [review_settings.py](./review_settings.py) | `ReviewSettings` keeps the label mode of classifications and the class minimums and duplicate suppression of every task, and remembers them. |
| [run_progress.py](./run_progress.py) | `RunProgress` is the progress of a running job, foreground or background. |
| [scheduled_call.py](./scheduled_call.py) | `ScheduledCall` is a callback scheduled to run later that can still be cancelled. |
| [session_mapper.py](./session_mapper.py) | `SessionMapper` restores the valid choices of the remembered session, hands out the remembered media of each task when it is first shown, and saves the current session. |
| [status_notifier.py](./status_notifier.py) | `StatusNotifier` tells the observers what changed and keeps the status and activity messages. |
| [task_classes.py](./task_classes.py) | `TaskClasses` holds the classes, reference images, drawings and class set of one task. |
| [task_media.py](./task_media.py) | `TaskMedia` holds the open media and shown picture of a task that is not shown. |
| [task_scheduler.py](./task_scheduler.py) | `TaskScheduler` abstracts the thread owning the workspace state, like the GUI thread of a desktop application. |
| [working_state.py](./working_state.py) | `WorkingState` is what the user works on right now, shared by the parts of the workspace: open media and shown picture of the current task, the media kept for the other tasks, and profiles. |
| [workspace.py](./workspace.py) | `Workspace` is the facade over the open media, classes, settings and the collaborators handling results, jobs and exports. |
| [workspace_observer.py](./workspace_observer.py) | `WorkspaceObserver` is a view following the workspace, always called on the owning thread. |
| [workspace_stores.py](./workspace_stores.py) | `WorkspaceStores` is the data directory the workspace reads at start and writes after changes. |
| [workspace_topic.py](./workspace_topic.py) | `WorkspaceTopic` enumerates the parts of the workspace a view shows, reported when they change. |
