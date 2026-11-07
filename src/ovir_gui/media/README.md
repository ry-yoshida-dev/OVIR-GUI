# media

## Overview

Media files opened in the GUI and the pixels read from them. `MediaCollection` finds image and video files in user-given paths, `MediaItem` describes an open file, and `FrameKey` identifies one recognizable picture: an image or one video frame chosen by `VideoSampling`. `PictureLoader` reads pixels for recognition and export, streaming each video once through `VideoFrameReader`; in the browser, videos are played with the VideoPlayerUI player instead, and `PlaybackProxyWriter` re-encodes those the browser cannot decode into H.264 with the FFmpeg torchcodec found at start (`ffmpeg/`). `ClassColors` gives stable class colors shared by the views and `export/`.

## Components

| Component | Description |
| --- | --- |
| [video/](./video/README.md) | Video stream properties, frame reading, frame sampling and playable copies. |
| [class_colors.py](./class_colors.py) | `ClassColors` assigns distinct, stable colors to class ids for every view and annotated export. |
| [collection.py](./collection.py) | `MediaCollection` collects image and video files from user-given paths, separating paths that add nothing. |
| [frame_key.py](./frame_key.py) | `FrameKey` identifies one recognizable picture: an image file or one frame of a video file. |
| [inference_mode.py](./inference_mode.py) | `InferenceMode` chooses which pictures are inferred: the shown picture only, or every picture with the shown media first. |
| [item.py](./item.py) | `MediaItem` describes an open media file: an image, or a video with its stream properties. |
| [keyed_picture.py](./keyed_picture.py) | `KeyedPicture` pairs the pixels of one picture with the key naming it, as handed to the recognizers. |
| [kind.py](./kind.py) | `MediaKind` enumerates the kinds of media file the user opens. |
| [loaded_image.py](./loaded_image.py) | `LoadedImage` holds an image read from disk, upright according to its EXIF orientation. |
| [loaded_picture.py](./loaded_picture.py) | `LoadedPicture` is one picture read by `PictureLoader`: its pixels or the error that kept it from being read. |
| [picture_loader.py](./picture_loader.py) | `PictureLoader` reads the pixels of images and video frames, streaming each video once for all requested frames. |
