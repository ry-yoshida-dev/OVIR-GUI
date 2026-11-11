# OVIR-GUI

## Overview

OVIR-GUI (Open-Vocabulary Image Recognition GUI) is a browser interface to run, review, compare and export
open-vocabulary classification, detection and segmentation on images and videos. Classes are written as text prompts
or drawn as reference boxes on example images, and every model shipped as a preset by
[OpenVocabularyClassification](https://github.com/ry-yoshida-dev/OpenVocabularyClassification),
[OpenVocabularyDetector](https://github.com/ry-yoshida-dev/OpenVocabularyDetector) and
[OpenVocabularySegmentation](https://github.com/ry-yoshida-dev/OpenVocabularySegmentation) can be selected. Videos are
played with the [VideoPlayerUI](https://github.com/ry-yoshida-dev/VideoPlayerUI) player, results are exported in
common annotation formats, and other web applications can embed the interface.

The server runs on this machine, and only the browser opening the printed address (it carries an access token) can use
it.

## Installation

```bash
uv sync                # the dependency versions tested in CI, from uv.lock
```

`pip install -e .` also works, but takes the newest commit of every dependency installed from GitHub.

YOLO-World and YOLOE run on [Ultralytics](https://www.ultralytics.com/license), which is licensed under AGPL-3.0, so it
is not installed by default. Install it only if your use complies with AGPL-3.0 or you hold an Ultralytics Enterprise
License:

```bash
uv sync --extra ultralytics
```

You are asked to accept the license the first time one of these models is chosen; delete `license_consent.json` in the
data directory to withdraw it. OVIR-GUI grants no license to Ultralytics or its weights, and its authors accept no
responsibility for how they are used.

Videos the browser cannot play (such as ProRes) are re-encoded with FFmpeg. On macOS and Linux, install it yourself
(`brew install ffmpeg`, `sudo apt install ffmpeg`); on Windows, `ovir-gui` offers to download a GPL-3.0 build from
[gyan.dev](https://github.com/GyanD/codexffmpeg). Without FFmpeg such videos are shown as frames decoded by the server.

## Usage

Run the commands below in the environment of the installation (`uv run ovir-gui ...`, or after activating `.venv`).

```bash
ovir-gui ~/footage            # open a folder of images and videos
ovir-gui --port 8080 --no-browser
```

Open the address printed in the terminal. On a remote machine, keep the default loopback host and forward the port
(`ssh -L 8000:localhost:8000 host`). `ovir-gui --help` lists every option.

To embed the interface in another application, start the server with the origin of the embedding page and a fixed
token, as described in [docs/embedding.md](docs/embedding.md):

```bash
OVIR_GUI_TOKEN=a-long-random-secret ovir-gui --no-browser --embed-origin http://localhost:3000
```

## Development

The built frontend is committed, so running the server needs no Node.js. After changing the frontend, build it again
as described in [frontend/README.md](frontend/README.md). The VideoPlayerUI packages come from the tarballs of one of
its GitHub releases; to update them, point both `@video-player-ui` dependencies of `frontend/package.json` at a newer
release.
