# picture_prompts

## Overview

Request bodies of `PicturePromptRoutes`: exemplar boxes and object marks drawn on pictures, the drawings removed together, and the picture whose drawings are cleared.

## Components

| Component | Description |
| --- | --- |
| [drawings_removal.py](./drawings_removal.py) | `DrawingsRemovalBody` names several drawings of a picture removed in one edit. |
| [exemplar.py](./exemplar.py) | `ExemplarBody` carries an exemplar box drawn on a picture. |
| [exemplar_removal.py](./exemplar_removal.py) | `ExemplarRemovalBody` names an exemplar box to remove from a picture. |
| [mark.py](./mark.py) | `MarkBody` carries the points and box marking one object on a picture. |
| [mark_removal.py](./mark_removal.py) | `MarkRemovalBody` names an object to unmark on one picture or on its whole file. |
| [picture.py](./picture.py) | `PictureBody` names one image or video frame. |
