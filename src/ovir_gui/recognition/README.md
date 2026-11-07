# recognition

## Overview

Library-independent types of what a model recognized. A `FrameResult` holds the outcome for one image or video frame: `ClassScore`s of a classifier with the `ClassifierLogits` they were computed from, or `RecognizedInstance`s of a detector or segmenter with their `PixelBox` and compact `InstanceMask`. `Finding` is one reviewable row of a result, as listed in the result tables; a classification lists its best class or every class depending on the `LabelMode`; `web/` serves the per-frame findings of a whole video from `GET /api/video-frames`. These types are produced by `inference/` and consumed by `results/`, `analysis/`, `review/` and `export/`.

## Components

| Component | Description |
| --- | --- |
| [array_types.py](./array_types.py) | Type aliases of the NumPy arrays used by results (`BoolArray`, `UInt8Array`, `Int32Array`, `FloatArray`). |
| [class_score.py](./class_score.py) | `ClassScore` holds the score of one class for a whole image, as a classifier reports it. |
| [classifier_logits.py](./classifier_logits.py) | `ClassifierLogits` keeps the logit of every text vector of a classified picture, so its class scores can be computed again with other aggregation steps on similarities. |
| [embedding_logit.py](./embedding_logit.py) | `EmbeddingLogit` is the logit of one text vector of a class: a phrase in one text template, a reference image, or a group of them merged on text vectors. |
| [finding.py](./finding.py) | `Finding` is one reviewable answer of a result: one class of a classified image or one detected or segmented instance. |
| [frame_result.py](./frame_result.py) | `FrameResult` holds what a model recognized in one image or video frame. |
| [image_size.py](./image_size.py) | `ImageSize` holds the pixel size of an image or a video frame. |
| [instance_mask.py](./instance_mask.py) | `InstanceMask` keeps the pixels of one instance compactly: its bounding box with one bit per pixel. |
| [label_mode.py](./label_mode.py) | `LabelMode` tells whether a picture is labelled with its best class only or with every class reaching its minimum. |
| [pixel_box.py](./pixel_box.py) | `PixelBox` is an axis-aligned box in pixels of the image it was found in. |
| [recognized_instance.py](./recognized_instance.py) | `RecognizedInstance` is one object a detector or segmenter found. |
| [task.py](./task.py) | `RecognitionTask` enumerates what a model recognizes in an image. |
