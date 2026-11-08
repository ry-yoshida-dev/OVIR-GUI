# external_programs

## Overview

External programs OVIR-GUI needs besides its Python dependencies, made available before the packages that use them are imported. Nothing here imports the rest of `ovir_gui`.

## Components

| Component | Description |
| --- | --- |
| [ffmpeg/](./ffmpeg/README.md) | `FFmpegStartupCheck` making the FFmpeg shared libraries available for torchcodec, downloading them on Windows. |
