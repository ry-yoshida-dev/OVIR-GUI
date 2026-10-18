# tests

## Overview

Pytest suite of `ovir_gui`. It runs without model weights: presets are only parsed into library settings, and the web
API is exercised through FastAPI's `TestClient` on generated media.

## Components

| Component | Description |
| --- | --- |
| [test_model_presets.py](./test_model_presets.py) | `TestModelPresets`: every preset of the three model libraries is read, and segmentation precision overrides reach the library settings. |
| [test_media_routes.py](./test_media_routes.py) | `TestMediaRoutes`: open videos are served with range requests, other files are refused, and `/api/video-frames` answers for an unrecognized video. |

## Examples

```bash
pip install -e ".[dev]"
pytest
```
