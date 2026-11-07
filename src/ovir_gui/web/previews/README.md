# previews

## Overview

Images sent to the browser: `PicturePreviewCache` keeps images and video frames encoded as JPEG, `PictureInfo` reads the size of an image file without decoding it, and `ImagePreview` answers an encoded image as a cached response.

## Components

| Component | Description |
| --- | --- |
| [cache.py](./cache.py) | `PicturePreviewCache` caches images and video frames encoded as JPEG for the browser. |
| [image.py](./image.py) | `ImagePreview` is an encoded image a browser can display, answered as a response cached for a day. |
| [picture_info.py](./picture_info.py) | `PictureInfo` holds the version and upright size of an image file, read without decoding its pixels. |
