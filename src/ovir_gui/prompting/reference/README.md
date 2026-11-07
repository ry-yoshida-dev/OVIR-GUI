# reference

## Overview

Visual queries drawn on reference images. A `ReferenceBox` is a box around an example of a class on a `ReferenceImage`; the boxes of one class on one reference image form a `VisualExample`, and `ReferenceBoard` collects every box and turns them into the queried classes of a run.

## Components

| Component | Description |
| --- | --- |
| [board.py](./board.py) | `ReferenceBoard` collects reference boxes drawn on reference images and turns them into the queried classes of a run. |
| [box.py](./box.py) | `ReferenceBox` is a box drawn by the user around an example of a class, used as an image prompt. |
| [image.py](./image.py) | `ReferenceImage` identifies the pixels a reference box is drawn on, independent of the file location. |
| [visual_example.py](./visual_example.py) | `VisualExample` holds one visual query: the boxes drawn on one reference image for one class. |
