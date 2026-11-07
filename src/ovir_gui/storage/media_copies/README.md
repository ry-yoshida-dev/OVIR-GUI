# media_copies

## Overview

Folders in the data directory holding copies of media files: `UploadStore` receives the images and videos uploaded from a browser, and `PlaybackStore` caches browser-playable copies of videos.

## Components

| Component | Description |
| --- | --- |
| [playback.py](./playback.py) | `PlaybackStore` caches browser-playable copies of videos in `playback`, keyed by the source path, size and modification time. |
| [uploads.py](./uploads.py) | `UploadStore` is the default folder `uploads` receiving images and videos sent from a browser, streamed to disk. |
