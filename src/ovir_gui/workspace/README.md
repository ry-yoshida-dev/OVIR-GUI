# workspace

## Overview

User-interface-independent application core. `Workspace` is the facade the web routes drive: it opens and shows media, edits the classes (via `ClassWorkbench`) and the settings, and exposes its collaborators for everything else. They share the `WorkingState` (open media and shown picture of the current task, the media and compared profiles kept for the other tasks, shown and compared profiles) and the `RecognitionSettings` (task, and the model, sampling and inference mode of each task) owned by the thread behind a `TaskScheduler`, so no part needs locks:

- `ModelChoice` picks the model of every task and the accepted licenses, and deletes downloaded weights the chosen model does not load; `TextTemplateLibrary` keeps the text templates saved for classifiers; `SessionMapper` restores and saves the session.
- `ResultReadModel` answers what the stored results say (statuses, freshness, statistics, comparison); `ReviewSettings` holds the label mode of classifications, the minimums and the duplicate suppression; `ResultProfiles` switches the shown and compared profile and records the user's review.
- `InferenceRunner` starts foreground jobs and background jobs on the `InferenceEngine`, whose single worker thread reports to the `InferenceOutcomeHandler`; `PromptAssembler` builds their prompts and `BackgroundPlanner` chooses what the background recognizes next.
- `ExportCoordinator` plans and writes exports and `PlaybackPreparer` encodes browser-playable video copies, both off the owning thread.
- `StatusNotifier` tells every `WorkspaceObserver` what changed (`WorkspaceTopic`) and keeps the status messages; `DeferredSave` writes the results shortly after changes, never overlapping a write at quit.

The `web` package implements the scheduler and the observer, and `WorkspaceStores` connects the workspace to the `storage` package.

## Components

| Component | Description |
| --- | --- |
| [exporting/](./exporting/README.md) | Planning and running exports of the stored results. |
| [jobs/](./jobs/README.md) | Recognition jobs: planning, running on a worker thread, progress and outcomes. |
| [messages/](./messages/README.md) | Replies to requests, notices and change notifications for the views. |
| [playback/](./playback/README.md) | Preparing browser-playable copies of open videos. |
| [scheduling/](./scheduling/README.md) | Scheduling on the owning thread and deferred saving of changed state. |
| [class_workbench.py](./class_workbench.py) | `ClassWorkbench` edits the classes of the current task with their phrases and reference images by class id, keeps the exemplar boxes and object marks drawn for them on pictures, and tracks their class set; every task keeps its own. |
| [facade.py](./facade.py) | `Workspace` is the facade over the open media, classes, settings and the collaborators handling results, jobs and exports. |
| [media_state.py](./media_state.py) | `MediaState` enumerates how far an open image or video is recognized with the shown model. |
| [media_status.py](./media_status.py) | `MediaStatus` is the recognition state of one open image or video with the shown model. |
| [model_choice.py](./model_choice.py) | `ModelChoice` holds the model chosen for each task with its overrides and the accepted licenses of optional modules, and lists and deletes the downloaded weights of the current task's presets. |
| [observer.py](./observer.py) | `WorkspaceObserver` is a view following the workspace, always called on the owning thread. |
| [opened_media.py](./opened_media.py) | `OpenedMedia` holds the image and video files found and read off the owning thread, before they are added to the open media. |
| [prompt_assembler.py](./prompt_assembler.py) | `PromptAssembler` builds the prompt of a model from the classes, reference images and drawings, asking approval to skip classes it cannot query. |
| [prompt_preparation.py](./prompt_preparation.py) | `PromptPreparation` holds the prompt built from the classes, or why none could be built. |
| [recognition_settings.py](./recognition_settings.py) | `RecognitionSettings` holds the task and, for each task, the model, the video sampling and the inference mode remembered in the session. |
| [result_profiles.py](./result_profiles.py) | `ResultProfiles` switches the shown and compared result profile, forgets profiles and records which findings the user keeps. |
| [result_read_model.py](./result_read_model.py) | `ResultReadModel` answers what the stored results say about the open media: statuses, freshness, summaries, statistics and comparison. |
| [review_settings.py](./review_settings.py) | `ReviewSettings` keeps the label mode of classifications and the class minimums and duplicate suppression of every task, and remembers them. |
| [session_mapper.py](./session_mapper.py) | `SessionMapper` restores the valid choices of the remembered session, hands out the remembered media of each task when it is first shown, and saves the current session. |
| [stores.py](./stores.py) | `WorkspaceStores` is the data directory the workspace reads at start and writes after changes. |
| [task_classes.py](./task_classes.py) | `TaskClasses` holds the classes, reference images, drawings and class set of one task. |
| [task_media.py](./task_media.py) | `TaskMedia` holds the open media and shown picture of a task that is not shown. |
| [text_template_library.py](./text_template_library.py) | `TextTemplateLibrary` keeps the text templates saved for reuse by every classifier, starting from those of the presets. |
| [topic.py](./topic.py) | `WorkspaceTopic` enumerates the parts of the workspace a view shows, reported when they change. |
| [working_state.py](./working_state.py) | `WorkingState` is what the user works on right now, shared by the parts of the workspace: open media and shown picture of the current task, the media and compared profiles kept for the other tasks, and profiles. |
