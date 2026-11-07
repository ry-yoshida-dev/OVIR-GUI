# media

## Overview

Media files opened in the GUI and the pixels read from them: collecting image and video files, identifying each recognizable picture, sampling video frames, reading pixels for recognition and export, and writing browser-playable video copies.

## Components

| Component | Description |
| --- | --- |
| [loading/](./loading/README.md) | Reading the pixels of images and sampled video frames for recognition and export. |
| [video/](./video/README.md) | Video stream properties, frame reading, frame sampling and playable copies. |
| [collection.py](./collection.py) | `MediaCollection` collects image and video files from user-given paths, separating paths that add nothing. |
| [frame_key.py](./frame_key.py) | `FrameKey` identifies one recognizable picture: an image file or one frame of a video file. |
| [inference_mode.py](./inference_mode.py) | `InferenceMode` chooses which pictures are inferred: the shown picture only, or every picture with the shown media first. |
| [item.py](./item.py) | `MediaItem` describes an open media file: an image, or a video with its stream properties. |
| [keyed_picture.py](./keyed_picture.py) | `KeyedPicture` pairs the pixels of one picture with the key naming it, as handed to the recognizers. |
| [kind.py](./kind.py) | `MediaKind` enumerates the kinds of media file the user opens. |
