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
| [classes/](./classes/README.md) | Classes of each task with their reference images and drawings, and the model prompt built from them. |
| [exporting/](./exporting/README.md) | Planning and running exports of the stored results. |
| [jobs/](./jobs/README.md) | Recognition jobs: planning, running on a worker thread, progress and outcomes. |
| [messages/](./messages/README.md) | Replies to requests, notices and change notifications for the views. |
| [open_media/](./open_media/README.md) | Open media of the tasks that are not shown, and files read before they are opened. |
| [playback/](./playback/README.md) | Preparing browser-playable copies of open videos. |
| [recognition/](./recognition/README.md) | What the user recognizes with (task, model, sampling, text templates) and how far each open file is recognized. |
| [review/](./review/README.md) | Switching the shown and compared result profile, the user's review of findings and the criteria findings must pass. |
| [scheduling/](./scheduling/README.md) | Scheduling on the owning thread and deferred saving of changed state. |
| [facade.py](./facade.py) | `Workspace` is the facade over the open media, classes, settings and the collaborators handling results, jobs and exports. |
| [result_read_model.py](./result_read_model.py) | `ResultReadModel` answers what the stored results say about the open media: statuses, freshness, pending pictures, statistics and comparison. |
| [session_mapper.py](./session_mapper.py) | `SessionMapper` restores the valid choices of the remembered session, hands out the remembered media of each task when it is first shown, and saves the current session. |
| [stores.py](./stores.py) | `WorkspaceStores` is the data directory the workspace reads at start and writes after changes. |
| [working_state.py](./working_state.py) | `WorkingState` is what the user works on right now, shared by the parts of the workspace: open media and shown picture of the current task, the media and compared profiles kept for the other tasks, and the shown and compared profiles. |
