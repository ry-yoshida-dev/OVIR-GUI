# OVIR-GUI

## Overview

OVIR-GUI (Open-Vocabulary Image Recognition GUI) is a browser interface to run, review, compare and export
open-vocabulary classification, detection and segmentation on images and videos. Classes are written as text phrases or
drawn as reference boxes on example images, and every model shipped as a preset by
[OpenVocabularyClassification](https://github.com/ry-yoshida-dev/OpenVocabularyClassification),
[OpenVocabularyDetector](https://github.com/ry-yoshida-dev/OpenVocabularyDetector) and
[OpenVocabularySegmentation](https://github.com/ry-yoshida-dev/OpenVocabularySegmentation) can be selected, with its
device, precision and thresholds.

- **Images and videos**: videos are recognized on every Nth frame and played in the browser with the frame-accurate
  [VideoPlayerUI](https://github.com/ry-yoshida-dev/VideoPlayerUI) player; boxes and masks of the latest recognized frame
  are drawn over every frame while it plays. Videos the browser cannot decode fall back to frames decoded by the server.
- **Review**: a filterable, sortable result table, per-class minimum confidences, keeping or rejecting single findings,
  a class timeline per video and statistics.
- **Comparison**: results of several models are kept side by side, and one can be overlaid on another.
- **Export**: YOLO and COCO labels, masks, class folders, CSV tables and annotated images and videos.

The server runs on this machine and only the browser opening the printed address (it carries an access token) can use it.

| Directory | Content |
| --------- | ------- |
| [src/ovir_gui](src/ovir_gui/README.md) | Python package: FastAPI server, workspace, models, results and exporters |
| [frontend](frontend) | React + TypeScript user interface, built into `src/ovir_gui/web/static` |
| [tests](tests/README.md) | Pytest suite |

## Installation

```bash
pip install -e .
```

## Usage

```bash
ovir-gui ~/footage            # open a folder of images and videos
ovir-gui --port 8080 --no-browser
```

Open the address printed in the terminal. On a remote machine, keep the default loopback host and forward the port
(`ssh -L 8000:localhost:8000 host`).

## Development

The built frontend is committed, so running the server needs no Node.js. To change the frontend, check out
[VideoPlayerUI](https://github.com/ry-yoshida-dev/VideoPlayerUI) next to this repository and build it first; the
frontend depends on its packages by relative path.

```bash
(cd ../VideoPlayerUI && npm install && npm run build)
cd frontend && npm install
npm run dev        # Vite dev server proxying /api to OVIR_GUI_BACKEND (default http://127.0.0.1:8000)
npm run build      # writes src/ovir_gui/web/static
```

```bash
pip install -e ".[dev]"
pytest
mypy --strict src/ovir_gui
basedpyright
ruff check src tests
```
