# workspace

## Overview

User-interface-independent application core. `Workspace` is the facade the web routes drive: it opens and shows media, edits classes and settings, and coordinates the collaborators that read results, run recognition jobs, export and save. Every part runs on the thread behind a `TaskScheduler`, which the `web` package implements.

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
