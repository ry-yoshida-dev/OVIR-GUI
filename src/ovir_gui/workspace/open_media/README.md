# open_media

## Overview

Image and video files the user has open beyond what `WorkingState` holds for the current task: `TaskMedia` keeps the open media of a task that is not shown, and `OpenedMedia` holds files read off the owning thread before they are added.

## Components

| Component | Description |
| --- | --- |
| [addition.py](./addition.py) | `OpenedMedia` holds the image and video files found and read off the owning thread, before they are added to the open media. |
| [task.py](./task.py) | `TaskMedia` holds the open media and shown picture of a task that is not shown. |
