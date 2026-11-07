# scheduling

## Overview

The thread owning the workspace state: `TaskScheduler` abstracts it, `ScheduledCall` is a callback scheduled on it, and `DeferredSave` writes changed state shortly after a change, off that thread.

## Components

| Component | Description |
| --- | --- |
| [deferred_save.py](./deferred_save.py) | `DeferredSave` writes one piece of workspace state shortly after it changes, off the owning thread, never overlapping or replacing a newer write. |
| [scheduled_call.py](./scheduled_call.py) | `ScheduledCall` is a callback scheduled to run later that can still be cancelled. |
| [task_scheduler.py](./task_scheduler.py) | `TaskScheduler` abstracts the thread owning the workspace state, like the GUI thread of a desktop application. |
