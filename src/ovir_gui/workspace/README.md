# workspace

## Overview

User-interface-independent application core. `Workspace` holds everything the user works on: open images and videos, the shown picture, classes (via `ClassWorkbench`), the model of every task, stored results and recognition jobs. Recognition runs on one worker thread in `InferenceEngine`, foreground jobs first and background jobs in between, while all workspace state is owned by the thread behind a `TaskScheduler`. Drawing on the shown picture recognizes it again at once when the chosen model reads the drawing; tracking models run whole videos in frame order. Views follow changes through `WorkspaceObserver` and `WorkspaceTopic`; the `web` package implements both the scheduler and the observer, and `WorkspaceStores` connects the workspace to the `storage` package.

## Components

| Component | Description |
| --- | --- |
| [action_reply.py](./action_reply.py) | `ActionReply` is the answer of the workspace to a request such as Detect, Detect All or Export. |
| [action_status.py](./action_status.py) | `ActionStatus` enumerates how the workspace answered a request of the user. |
| [background_planner.py](./background_planner.py) | `BackgroundPlanner` chooses which image to recognize next in the background and remembers what failed. |
| [background_scope.py](./background_scope.py) | `BackgroundScope` enumerates which images are recognized in the background while the user works; videos are recognized only when run. |
| [class_workbench.py](./class_workbench.py) | `ClassWorkbench` edits the classes with their phrases and reference images by class id, keeps the exemplar boxes and object marks drawn for them on pictures, and tracks their class set. |
| [deferred_save.py](./deferred_save.py) | `DeferredSave` writes one piece of workspace state shortly after it changes, off the owning thread. |
| [export_plan.py](./export_plan.py) | `ExportPlan` describes what an export would write now. |
| [export_request.py](./export_request.py) | `ExportRequest` is the export chosen by the user. |
| [inference_engine.py](./inference_engine.py) | `InferenceEngine` runs recognition jobs on one worker thread, foreground jobs first and background jobs in between. |
| [inference_job.py](./inference_job.py) | `InferenceJob` holds the pictures to recognize with one model and prompt. |
| [inference_listener.py](./inference_listener.py) | `InferenceListener` receives what the `InferenceEngine` reports, always on the owning thread. |
| [job_control.py](./job_control.py) | `JobControl` is shared with the worker and tells whether a job should stop and how far it has come. |
| [job_purpose.py](./job_purpose.py) | `JobPurpose` enumerates why a recognition job runs. |
| [job_summary.py](./job_summary.py) | `JobSummary` describes how a job ended. |
| [media_state.py](./media_state.py) | `MediaState` enumerates how far an open image or video is recognized with the shown model. |
| [media_status.py](./media_status.py) | `MediaStatus` is the recognition state of one open image or video with the shown model. |
| [notice.py](./notice.py) | `Notice` is a message for the user about something that happened, such as a finished run or a failed save. |
| [notice_level.py](./notice_level.py) | `NoticeLevel` enumerates how prominently a notice is shown. |
| [playback_state.py](./playback_state.py) | `PlaybackState` enumerates whether a video has a browser-playable copy. |
| [playback_store.py](./playback_store.py) | `PlaybackStore` caches browser-playable copies of videos, keyed by the source file. |
| [prompt_preparation.py](./prompt_preparation.py) | `PromptPreparation` holds the prompt built from the classes, or why none could be built. |
| [run_progress.py](./run_progress.py) | `RunProgress` is the progress of the running foreground job. |
| [scheduled_call.py](./scheduled_call.py) | `ScheduledCall` is a callback scheduled to run later that can still be cancelled. |
| [task_scheduler.py](./task_scheduler.py) | `TaskScheduler` abstracts the thread owning the workspace state, like the GUI thread of a desktop application. |
| [upload_store.py](./upload_store.py) | `UploadStore` is the default folder receiving images and videos sent from a browser, streamed to disk. |
| [workspace.py](./workspace.py) | `Workspace` holds everything the user works on and coordinates media, classes, models, results and recognition jobs. |
| [workspace_observer.py](./workspace_observer.py) | `WorkspaceObserver` is a view following the workspace, always called on the owning thread. |
| [workspace_stores.py](./workspace_stores.py) | `WorkspaceStores` is the data directory the workspace reads at start and writes after changes. |
| [workspace_topic.py](./workspace_topic.py) | `WorkspaceTopic` enumerates the parts of the workspace a view shows, reported when they change. |
