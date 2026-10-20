# tests

## Overview

Pytest suite of `ovir_gui`. It runs without model weights: presets are only parsed into library settings, and the web
API is exercised through FastAPI's `TestClient` on generated media.

## Components

| Component | Description |
| --- | --- |
| [test_background_planner.py](./test_background_planner.py) | `TestBackgroundPlanner`: background recognition covers images only and skips videos. |
| [test_embedding.py](./test_embedding.py) | `TestEmbeddingPolicy`, `TestCommandLineEmbedding`: embedding origins and the fixed access token. |
| [test_embedding_routes.py](./test_embedding_routes.py) | `TestEmbeddingRoutes`: parent origins, result documents and framing headers of every response. |
| [test_media_routes.py](./test_media_routes.py) | `TestMediaRoutes`: open videos are served with range requests, other files are refused, `/api/video-frames` answers for an unrecognized video, and a playable copy replaces the served video. |
| [test_model_presets.py](./test_model_presets.py) | `TestModelPresets`: every preset of the three model libraries is read, including the promptable, generation and tracking presets, each segmentation mode decides its prompting, and segmentation precision overrides reach the library settings. |
| [test_picture_prompt_routes.py](./test_picture_prompt_routes.py) | `TestPicturePromptRoutes`: exemplar boxes and object marks are drawn, shown and remembered, every segmentation mode describes its prompting, and mark models refuse to run without marks. |
| [test_picture_prompts.py](./test_picture_prompts.py) | `TestPicturePromptBoard`, `TestDrawnSignature`, `TestStreamPosition`, `TestDrawingPersistence`: drawings follow their class, outdate exactly the pictures depending on them and survive a restart. |
| [test_playback_store.py](./test_playback_store.py) | `TestPlaybackStore`: playable copies are keyed by the source path, size and modification time. |
| [test_segmenter_exemplars.py](./test_segmenter_exemplars.py) | `TestSegmenterExemplars`: SAM 3 reads the exemplar boxes of each picture, and exemplar-only classes are segmented only where they have a positive box. |
| [test_upload_store.py](./test_upload_store.py) | `TestUploadStore`: uploads are streamed to disk, identical content reuses its copy and other content is numbered. |

## Examples

```bash
pip install -e ".[dev]"
pytest
```
