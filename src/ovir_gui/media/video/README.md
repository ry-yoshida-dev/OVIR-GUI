# video

## Overview

Video files: `VideoInfo` holds the stream properties, `VideoFrameReader` reads frames through `time_series_iterator`, `VideoSampling` selects which frames are recognized, and `PlaybackProxyWriter` re-encodes videos the browser cannot decode.

## Components

| Component | Description |
| --- | --- |
| [frame_reader.py](./frame_reader.py) | `VideoFrameReader` reads frames of one video file through `time_series_iterator`. |
| [info.py](./info.py) | `VideoInfo` holds the stream properties of a video file. |
| [playback_proxy_writer.py](./playback_proxy_writer.py) | `PlaybackProxyWriter` re-encodes a video the browser cannot decode into a frame-aligned H.264 copy. |
| [sampling.py](./sampling.py) | `VideoSampling` selects which video frames are recognized: every `frame_step`-th frame from the first. |
