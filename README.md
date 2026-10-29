# OVIR-GUI

## Overview

OVIR-GUI (Open-Vocabulary Image Recognition GUI) is a browser interface to run, review, compare and export
open-vocabulary classification, detection and segmentation on images and videos. Classes are written as text phrases or
drawn as reference boxes on example images, and every model shipped as a preset by
[OpenVocabularyClassification](https://github.com/ry-yoshida-dev/OpenVocabularyClassification),
[OpenVocabularyDetector](https://github.com/ry-yoshida-dev/OpenVocabularyDetector) and
[OpenVocabularySegmentation](https://github.com/ry-yoshida-dev/OpenVocabularySegmentation) can be selected, with its
device, precision, batch size, thresholds and, for classifiers, the text templates phrases are written into.

- **Images and videos**: videos are recognized on every Nth frame and played in the browser with the frame-accurate
  [VideoPlayerUI](https://github.com/ry-yoshida-dev/VideoPlayerUI) player; boxes and masks are drawn only on the recognized
  frames, or interpolated between adjacent recognized frames when interpolation is on. With automatic inference on,
  playing a video infers the frames just ahead of playback, slowing or pausing playback so every shown frame has its
  findings. Videos the browser cannot decode fall back to frames decoded by the server.
- **Segmentation modes**: besides phrases, SAM 3 takes reference images and positive and negative exemplar boxes
  drawn on each picture; SAM, SAM 2, the SAM 3 tracker, EdgeTAM and Florence-2 segment objects marked by clicks and
  boxes, refined click by click; automatic mask generation segments every region; video trackers follow marked
  objects, or every instance of phrases and reference images, through a video.
- **Review**: a filterable, sortable result table and a Review panel of confidence and NMS IoU histograms over every result, for all classes, each class and each phrase, with kept counts. Dragging, arrow keys or typing on a chart moves its threshold at once without recognizing again; the reset button beside a chart (or double-clicking it) takes a class or phrase back to its parent value, and the reset button in the Review heading restores every threshold of the shown chart type. Filtered-out findings are shown faded or hidden, chosen in the view settings.
  (detectors and segmenters keep findings down to a low floor), keeping or rejecting single findings,
  a class timeline per video and statistics.
- **Statistics** (Ctrl+I): per-class kept counts, review outcome, picture coverage, confidence spread against the
  minimum and COCO object sizes; a curve per class of what every minimum confidence would keep, dragged to set it;
  classes covering the same objects or appearing together (runner-up classes and top-score margins for
  classifiers); pictures worth a look, such as crowded, empty or borderline ones; and the agreement with another
  model per class and per picture.
- **Comparison**: results of several models are kept side by side, and one can be overlaid on another.
- **Model weights**: the model list shows the disk space of every downloaded checkpoint and deletes it from this
  computer; its results are kept, and it is downloaded again when chosen.
- **Export**: from the Images table, the pictures and findings it lists; from the Videos panel, every kept finding of the videos. Formats are YOLO, COCO and LabelMe boxes or mask polygons, mask images, classification labels (class-column or label-list CSV, Hugging Face imagefolder, Pascal VOC image sets, Open Images), class folders, CSV tables and annotated images and videos.
- **Embedding**: another web application, such as a GIS, can show the interface in a window of its own page and drive
  it with `postMessage`: open pictures and receive the findings of the shown model as polygons.

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

Videos the browser cannot play (such as ProRes) are re-encoded for playback with FFmpeg, through torchcodec. On
macOS and Linux, install FFmpeg yourself (`brew install ffmpeg`, `sudo apt install ffmpeg`). On Windows, when FFmpeg
is missing, `ovir-gui` offers at start to download a GPL-3.0 build from
[gyan.dev](https://github.com/GyanD/codexffmpeg) into `%LOCALAPPDATA%\ovir-gui\ffmpeg`; a declined download is not
offered again, and `ovir-gui --download-ffmpeg` downloads it later. Without FFmpeg such videos are shown as frames
decoded by the server, and inference works either way.

## Usage

```bash
ovir-gui ~/footage            # open a folder of images and videos
ovir-gui --port 8080 --no-browser
```

Open the address printed in the terminal. On a remote machine, keep the default loopback host and forward the port
(`ssh -L 8000:localhost:8000 host`).

### Embedding in another application

Start the server with the origin of the embedding page and a fixed token, so that page knows the address:

```bash
OVIR_GUI_TOKEN=a-long-random-secret ovir-gui --no-browser --embed-origin http://localhost:3000
```

The page shows `http://localhost:8000/?token=a-long-random-secret` in an `<iframe>`. Only the listed origins may frame
the interface (`Content-Security-Policy: frame-ancestors`). The access cookie is `SameSite=Lax`, so the embedding page
must be on the same site as the server, e.g. both on `localhost` (mixing `localhost` and `127.0.0.1` does not work).

Messages are plain objects sent with `iframe.contentWindow.postMessage(message, serverOrigin)`. A request may carry a
`request_id`; every request is answered with `{type: "ovir-gui:response", request_id, ok, payload | error}`.

| Request | Fields | Effect |
| --- | --- | --- |
| `ovir-gui:open` | `paths`, `show` (optional) | Opens server paths and shows `show` (or the only path) |
| `ovir-gui:show` | `path`, `frame` (optional) | Shows an open picture or video frame |
| `ovir-gui:close` | `paths` | Closes open files |
| `ovir-gui:get-results` | `paths` (optional) | Answers with the kept findings of the shown model |

The interface also posts `ovir-gui:ready` once it listens and `ovir-gui:current-changed` (`path`, `frame`) when
another picture is shown. A document lists pictures with their size and objects:

```json
{
  "format": "ovir-gui-objects", "version": 1, "model": "sam3/litetext_s0",
  "coordinate_space": "pixels of the upright picture (EXIF orientation applied), origin at top-left",
  "pictures": [{"path": "/data/IMG_0012.jpg", "frame": null, "width": 4000, "height": 3000, "objects": [
    {"index": 0, "class_name": "building", "source": "building", "confidence": 0.95,
     "box": [1175, 720, 1379, 834], "area": 9374, "polygons": [[[1175, 720], [1379, 722], ...]]}
  ]}]
}
```

Polygons are outer rings in pixels of the upright picture; the embedding application maps them onto its own
coordinates, e.g. with the geotransform of an orthophoto. [examples/embed/index.html](examples/embed/index.html) is a
host page opening the interface in a movable window.

## Development

The built frontend is committed, so running the server needs no Node.js. The frontend takes the
[VideoPlayerUI](https://github.com/ry-yoshida-dev/VideoPlayerUI) packages from the tarballs of one of its GitHub
releases; to update them, point both `@video-player-ui` dependencies of `frontend/package.json` at a newer release.

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
