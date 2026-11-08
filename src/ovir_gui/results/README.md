# results

## Overview

Recognition results. The library-independent types of what a model recognized (per-picture results with class scores or detected and segmented instances, and the reviewable findings listed in the result tables) are produced by `inference/` and consumed by `analysis/`, `review/` and `export/`. `in_memory/` keeps the latest of them per model profile.

## Components

| Component | Description |
| --- | --- |
| [classification/](./classification/README.md) | What a classifier reports for a whole picture: class scores, the logits they came from, and how a picture is labeled from them. |
| [in_memory/](./in_memory/README.md) | `ResultLibrary` keeping the latest result of every picture per model profile while the application runs. |
| [array_types.py](./array_types.py) | Type aliases of the NumPy arrays used by results (`BoolArray`, `UInt8Array`, `Int32Array`, `FloatArray`). |
| [finding.py](./finding.py) | `Finding` is one reviewable answer of a result: one class of a classified image or one detected or segmented instance. |
| [frame.py](./frame.py) | `FrameResult` holds what a model recognized in one image or video frame. |
| [image_size.py](./image_size.py) | `ImageSize` holds the pixel size of an image or a video frame. |
| [instance.py](./instance.py) | `RecognizedInstance` is one object a detector or segmenter found. |
| [instance_mask.py](./instance_mask.py) | `InstanceMask` keeps the pixels of one instance compactly: its bounding box with one bit per pixel. |
| [pixel_box.py](./pixel_box.py) | `PixelBox` is an axis-aligned box in pixels of the image it was found in. |
| [task.py](./task.py) | `RecognitionTask` enumerates what a model recognizes in an image. |
