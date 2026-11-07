# picture_prompts

## Overview

What the user draws on the recognized pictures themselves: `ExemplarBox`es showing or excluding a class there (SAM 3) and `ObjectMark`s of points and a box marking single objects (promptable segmenters and video trackers). `FramePrompt` holds the drawings of one picture or one tracked video, `PicturePromptBoard` collects them while the user edits, and `PicturePrompts` is the snapshot a run takes of them.

## Components

| Component | Description |
| --- | --- |
| [board.py](./board.py) | `PicturePromptBoard` collects the exemplar boxes and object marks drawn on the pictures, following class renames. |
| [exemplar_box.py](./exemplar_box.py) | `ExemplarBox` is a box drawn on a recognized picture showing what a class is, or is not, there. |
| [frame.py](./frame.py) | `FramePrompt` holds the exemplar boxes and object marks drawn on one picture or one video. |
| [object_mark.py](./object_mark.py) | `ObjectMark` holds the points and box marking one object of a class on one picture. |
| [snapshot.py](./snapshot.py) | `PicturePrompts` is a detached copy of every drawing, looked up per picture or per media file. |
