# ffmpeg

## Overview

Makes the FFmpeg shared libraries available at start, before torchcodec is imported, since torchcodec looks for them only once per process. FFmpeg only encodes the browser-playable copies of videos the browser cannot decode; without it such videos are shown as frames decoded by the server and inference works as before.

`__main__.py` runs `FFmpegStartupCheck` right after parsing the command line. A build downloaded earlier is put first on `PATH`; otherwise `FFmpegProbe` asks a separate Python process whether torchcodec finds FFmpeg, and on Windows, in a terminal, the user is offered to download a GPL build (it includes the H.264 encoder) from https://github.com/GyanD/codexffmpeg. The build is checked against its SHA-256 and kept in `%LOCALAPPDATA%\ovir-gui\ffmpeg`, shared by every data directory. A declined download is not offered again; `ovir-gui --download-ffmpeg` downloads it without a question. On macOS and Linux a line tells how to install FFmpeg.

## Components

| Component | Description |
| --- | --- |
| [startup_check.py](./startup_check.py) | `FFmpegStartupCheck` uses, checks, offers and downloads FFmpeg at start. |
| [downloader.py](./downloader.py) | `FFmpegDownloader` downloads the pinned Windows build, checks its SHA-256 and installs its `bin` folder and license. |
| [installation.py](./installation.py) | `FFmpegInstallation` is the folder of the downloaded build and of a declined download, and puts the build on `PATH`. |
| [probe.py](./probe.py) | `FFmpegProbe` tells whether torchcodec finds FFmpeg, checked in a separate process. |
| [operating_system.py](./operating_system.py) | `OperatingSystem` decides whether FFmpeg is downloaded and how the user installs it otherwise. |

## Examples

```bash
ovir-gui                      # offers the download on Windows when FFmpeg is missing
ovir-gui --download-ffmpeg    # downloads it without a question, also after a decline
```
