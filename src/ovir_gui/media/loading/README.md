# loading

## Overview

Reading the pixels of pictures for recognition and export. `PictureLoader` reads images and sampled video frames, streaming each video once for all requested frames, and returns a `LoadedPicture` per picture; images are read as `LoadedImage`s, upright according to their EXIF orientation.

## Components

| Component | Description |
| --- | --- |
| [image.py](./image.py) | `LoadedImage` holds an image read from disk, upright according to its EXIF orientation. |
| [loader.py](./loader.py) | `PictureLoader` reads the pixels of images and video frames, streaming each video once for all requested frames. |
| [picture.py](./picture.py) | `LoadedPicture` is one picture read by `PictureLoader`: its pixels or the error that kept it from being read. |
