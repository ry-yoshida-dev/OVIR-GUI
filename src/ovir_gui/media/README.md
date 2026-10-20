# media

## Overview

Media files opened in the GUI and the pixels read from them. `MediaCollection` finds image and video files in user-given paths, `MediaItem` describes an open file, and `FrameKey` identifies one recognizable picture: an image or one video frame chosen by `VideoSampling`. `PictureLoader` reads pixels for recognition and export, streaming each video once through `VideoFrameReader`; in the browser, videos are played with the VideoPlayerUI player instead, and `PlaybackProxyWriter` re-encodes those the browser cannot decode into H.264. `ClassColors` gives stable class colors shared by the views and `export/`.

## Components

| Component | Description |
| --- | --- |
| [class_colors.py](./class_colors.py) | `ClassColors` assigns distinct, stable colors to class ids for every view and annotated export. |
| [frame_key.py](./frame_key.py) | `FrameKey` identifies one recognizable picture: an image file or one frame of a video file. |
| [keyed_picture.py](./keyed_picture.py) | `KeyedPicture` pairs the pixels of one picture with the key naming it, as handed to the recognizers. |
| [loaded_image.py](./loaded_image.py) | `LoadedImage` holds an image read from disk, upright according to its EXIF orientation. |
| [media_collection.py](./media_collection.py) | `MediaCollection` collects image and video files from user-given paths, separating paths that add nothing. |
| [media_item.py](./media_item.py) | `MediaItem` describes an open media file: an image, or a video with its stream properties. |
| [media_kind.py](./media_kind.py) | `MediaKind` enumerates the kinds of media file the user opens. |
| [picture_loader.py](./picture_loader.py) | `PictureLoader` reads the pixels of images and video frames, streaming each video once for all requested frames. |
| [playback_proxy_writer.py](./playback_proxy_writer.py) | `PlaybackProxyWriter` re-encodes a video the browser cannot decode into a frame-aligned H.264 copy. |
| [video_frame_reader.py](./video_frame_reader.py) | `VideoFrameReader` reads frames of one video file through `time_series_iterator`. |
| [video_info.py](./video_info.py) | `VideoInfo` holds the stream properties of a video file. |
| [video_sampling.py](./video_sampling.py) | `VideoSampling` selects which video frames are recognized: every `frame_step`-th frame from the first. |
