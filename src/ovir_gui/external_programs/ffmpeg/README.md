# ffmpeg

## Overview

Makes the FFmpeg shared libraries available at start, before torchcodec is imported, and offers to download them on Windows. FFmpeg only encodes browser-playable copies of videos the browser cannot decode.

## Components

| Component | Description |
| --- | --- |
| [downloader.py](./downloader.py) | `FFmpegDownloader` downloads the pinned Windows build, checks its SHA-256 and installs its `bin` folder and license. |
| [installation.py](./installation.py) | `FFmpegInstallation` is the folder of the downloaded build and of a declined download, and puts the build on `PATH`. |
| [operating_system.py](./operating_system.py) | `OperatingSystem` decides whether FFmpeg is downloaded and how the user installs it otherwise. |
| [probe.py](./probe.py) | `FFmpegProbe` tells whether torchcodec finds FFmpeg, checked in a separate process. |
| [startup_check.py](./startup_check.py) | `FFmpegStartupCheck` uses, checks, offers and downloads FFmpeg at start. |
