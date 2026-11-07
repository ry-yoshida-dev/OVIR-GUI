# recognition

## Overview

What the user recognizes with and how far it has got: `RecognitionSettings` holds the task with the model, sampling and inference mode of each task, `ModelChoice` the model of every task and the accepted licenses, and `TextTemplateLibrary` the text templates offered to classifiers. `MediaStatus` and `MediaState` tell how far each open image or video is recognized with the shown model.

## Components

| Component | Description |
| --- | --- |
| [media_state.py](./media_state.py) | `MediaState` enumerates how far an open image or video is recognized with the shown model. |
| [media_status.py](./media_status.py) | `MediaStatus` is the recognition state of one open image or video with the shown model. |
| [model_choice.py](./model_choice.py) | `ModelChoice` holds the model chosen for each task with its overrides and the accepted licenses of optional modules, and lists and deletes the downloaded weights of the current task's presets. |
| [settings.py](./settings.py) | `RecognitionSettings` holds the task and, for each task, the model, the video sampling and the inference mode remembered in the session. |
| [text_templates.py](./text_templates.py) | `TextTemplateLibrary` keeps the text templates saved for reuse by every classifier, starting from those of the presets. |
