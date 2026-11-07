# OVIR-GUI

## Overview

OVIR-GUI (Open-Vocabulary Image Recognition GUI) is a browser interface to run, review, compare and export
open-vocabulary classification, detection and segmentation on images and videos. Classes are written as text prompts
or drawn as reference boxes on example images, and every model shipped as a preset by
[OpenVocabularyClassification](https://github.com/ry-yoshida-dev/OpenVocabularyClassification),
[OpenVocabularyDetector](https://github.com/ry-yoshida-dev/OpenVocabularyDetector) and
[OpenVocabularySegmentation](https://github.com/ry-yoshida-dev/OpenVocabularySegmentation) can be selected, with its
device, precision, batch size, thresholds and, for classifiers, the templates prompts are written into.

- **Images and videos**: videos are recognized on every Nth frame and played frame-accurately with the
  [VideoPlayerUI](https://github.com/ry-yoshida-dev/VideoPlayerUI) player; boxes and masks are drawn on the recognized
  frames, or interpolated between them. With automatic inference on, playing a video infers the frames just ahead of
  playback. Videos the browser cannot decode fall back to frames decoded by the server.
- **Segmentation modes**: besides text prompts, SAM 3 takes reference images and positive and negative exemplar boxes
  drawn on each picture; SAM, SAM 2, the SAM 3 tracker, EdgeTAM and Florence-2 segment objects marked by clicks and
  boxes; automatic mask generation segments every region; video trackers follow marked objects, or every instance of
  a class, through a video.
- **Review**: a filterable, sortable result table, confidence and NMS IoU histograms per class and per prompt whose
  thresholds are dragged without recognizing again (detectors and segmenters keep findings down to a low floor),
  keeping or rejecting single findings, and a class timeline per video.
- **Statistics** (Ctrl+I): per-class kept counts, picture coverage, confidence spread and COCO object sizes; classes
  covering the same objects or appearing together; pictures worth a look, such as crowded, empty or borderline ones;
  and the agreement with another model.
- **Comparison**: results of several models are kept side by side, and one can be overlaid on another.
- **Model weights**: the model list shows the disk space of every downloaded checkpoint and deletes it; its results
  are kept, and it is downloaded again when chosen.
- **Export**: the pictures listed in the Images table, or every kept finding of the videos, as YOLO, COCO and LabelMe
  boxes or mask polygons, mask images, classification labels (CSV, Hugging Face imagefolder, Pascal VOC image sets,
  Open Images), class folders, CSV tables and annotated images and videos.
- **Embedding**: another web application, such as a GIS, can show the interface in a window of its own page, open
  pictures and receive the findings as polygons ([protocol](docs/embedding.md)).

The server runs on this machine, and only the browser opening the printed address (it carries an access token) can use
it.

| Directory | Content |
| --------- | ------- |
| [src/ovir_gui](src/ovir_gui/README.md) | Python package: FastAPI server, workspace, inference, results and exporters |
| [frontend](frontend/README.md) | React + TypeScript user interface, built into `src/ovir_gui/web/static` |
| [tests](tests/README.md) | Pytest suite |
| [docs](docs/embedding.md) | Embedding protocol |
| [examples](examples/embed/README.md) | Host page embedding the interface |

## Installation

```bash
pip install -e .
```

YOLO-World and YOLOE run on [Ultralytics](https://www.ultralytics.com/license), which is licensed under AGPL-3.0, so it
is not installed by default. Install it only if your use complies with AGPL-3.0 or you hold an Ultralytics Enterprise
License:

```bash
pip install -e ".[ultralytics]"
```

The first time one of these models is chosen, you are asked to confirm that your use complies with the license and
that you alone are responsible for it, before the `ultralytics` module is imported. The acceptance is remembered in
`license_consent.json` of the data directory; delete that file to withdraw it. OVIR-GUI grants no license to
Ultralytics or its weights, and its authors accept no responsibility for how they are used.

Videos the browser cannot play (such as ProRes) are re-encoded for playback with FFmpeg. On macOS and Linux, install
FFmpeg yourself (`brew install ffmpeg`, `sudo apt install ffmpeg`). On Windows, when FFmpeg is missing, `ovir-gui`
offers at start to download a GPL-3.0 build from [gyan.dev](https://github.com/GyanD/codexffmpeg) into `%LOCALAPPDATA%\ovir-gui\ffmpeg`; a declined download
is not offered again, and `ovir-gui --download-ffmpeg` downloads it later. Without FFmpeg such videos are shown as
frames decoded by the server, and inference works either way.

## Usage

```bash
ovir-gui ~/footage            # open a folder of images and videos
ovir-gui --port 8080 --no-browser
```

Open the address printed in the terminal. Without paths, the media of the last session are opened again. On a remote
machine, keep the default loopback host and forward the port (`ssh -L 8000:localhost:8000 host`). `ovir-gui --help`
lists every option.

To embed the interface in another application, start the server with the origin of the embedding page and a fixed
token, as described in [docs/embedding.md](docs/embedding.md):

```bash
OVIR_GUI_TOKEN=a-long-random-secret ovir-gui --no-browser --embed-origin http://localhost:3000
```

## Development

The built frontend is committed, so running the server needs no Node.js. After changing the frontend, build it again.
The [VideoPlayerUI](https://github.com/ry-yoshida-dev/VideoPlayerUI) packages come from the tarballs of one of its
GitHub releases; to update them, point both `@video-player-ui` dependencies of `frontend/package.json` at a newer
release.

```bash
cd frontend && npm install
npm run dev        # Vite dev server proxying /api to OVIR_GUI_BACKEND (default http://127.0.0.1:8000)
npm run build      # writes src/ovir_gui/web/static
npm run lint       # ESLint from frontend/lint, installed by npm install
```

```bash
pip install -e ".[dev]"
pytest
mypy --strict src/ovir_gui
basedpyright
ruff check src tests
```
