# jobs

## Overview

Recognition jobs: `InferenceRunner` starts foreground jobs at the user's request and background jobs chosen by `BackgroundPlanner`, `InferenceEngine` runs them on one worker thread, and `InferenceOutcomeHandler` stores what they report. `JobControl`, `RunProgress` and `JobSummary` describe a job while it runs and after it ends.

## Components

| Component | Description |
| --- | --- |
| [background_planner.py](./background_planner.py) | `BackgroundPlanner` chooses what to recognize next in the background for the inference mode, frames ahead of a playing video first, and remembers what failed. |
| [control.py](./control.py) | `JobControl` is shared with the worker and tells whether a job should stop and how far it has come. |
| [engine.py](./engine.py) | `InferenceEngine` runs recognition jobs on one worker thread, foreground jobs first and background jobs in between. |
| [inference.py](./inference.py) | `InferenceJob` holds the pictures to recognize with one model and prompt. |
| [listener.py](./listener.py) | `InferenceListener` receives what the `InferenceEngine` reports, always on the owning thread. |
| [outcome_handler.py](./outcome_handler.py) | `InferenceOutcomeHandler` is the `InferenceListener` of the workspace: it stores recognized results, reports progress and job ends, and continues in the background. |
| [progress.py](./progress.py) | `RunProgress` is the progress of a running job, foreground or background. |
| [purpose.py](./purpose.py) | `JobPurpose` enumerates why a recognition job runs. |
| [runner.py](./runner.py) | `InferenceRunner` starts foreground jobs at the user's request and background jobs whenever the engine is idle. |
| [summary.py](./summary.py) | `JobSummary` describes how a job ended. |
