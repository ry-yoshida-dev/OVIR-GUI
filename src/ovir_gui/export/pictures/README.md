# pictures

## Overview

The pictures an export writes: each exported picture, which of its findings are exported and its image file.

## Components

| Component | Description |
| --- | --- |
| [files.py](./files.py) | `PictureFiles` provides the image file of every exported picture, writing a JPEG for video frames. |
| [item.py](./item.py) | `ExportItem` describes one picture as it is exported. |
| [selection.py](./selection.py) | `ExportSelection` holds which stored findings of a picture are exported. |
