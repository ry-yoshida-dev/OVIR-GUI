# picture_prompts

## Overview

What the user draws on the recognized pictures themselves: exemplar boxes showing or excluding a class there (SAM 3) and object marks of points and a box (promptable segmenters and video trackers).

## Components

| Component | Description |
| --- | --- |
| [board.py](./board.py) | `PicturePromptBoard` collects the exemplar boxes and object marks drawn on the pictures, following class renames, with undo and redo per media file. |
| [exemplar_box.py](./exemplar_box.py) | `ExemplarBox` is a box drawn on a recognized picture showing what a class is, or is not, there. |
| [frame.py](./frame.py) | `FramePrompt` holds the exemplar boxes and object marks drawn on one picture or one video. |
| [history.py](./history.py) | `EditHistory` keeps the earlier and undone drawings of each media file for undo and redo. |
| [object_mark.py](./object_mark.py) | `ObjectMark` holds the points and box marking one object of a class on one picture. |
| [snapshot.py](./snapshot.py) | `PicturePrompts` is a detached copy of every drawing, looked up per picture or per media file. |
