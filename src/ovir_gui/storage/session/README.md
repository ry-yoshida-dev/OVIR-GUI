# session

## Overview

The session restored at the next start: `SessionStore` remembers a `Session` with the open media (`SessionMedia`) and the sampling and inference choices (`SessionTaskSettings`) of each task.

## Components

| Component | Description |
| --- | --- |
| [media.py](./media.py) | `SessionMedia` holds the open media and shown picture one task had in the session. |
| [state.py](./state.py) | `Session` describes what the user was working on, restored at the next start. |
| [store.py](./store.py) | `SessionStore` remembers the open media, shown picture, sampling, inference and model choices of each task and the chosen task in `session.json`. |
| [task_settings.py](./task_settings.py) | `SessionTaskSettings` holds the sampling and inference choices one task had in the session. |
