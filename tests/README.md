# tests

## Overview

Pytest suite of `ovir_gui`. It runs without model weights: presets are only parsed into library settings, and the web
API is exercised through FastAPI's `TestClient` on generated media, with `FakeRecognizerSession` standing in for the models where results are needed.

## Components

| Component | Description |
| --- | --- |
| [fake_recognizer_session.py](./fake_recognizer_session.py) | `FakeRecognizerSession`: deterministic detection and classification results without loading weights. |
| [golden_snapshot.py](./golden_snapshot.py) | `GoldenSnapshot`: compares API documents with the files recorded under `golden/` (`OVIR_GUI_UPDATE_GOLDEN=1` records them again). |
| [manual_scheduled_call.py](./manual_scheduled_call.py) | `ManualScheduledCall`: handle of a delayed callback of `ManualTaskScheduler`. |
| [manual_task_scheduler.py](./manual_task_scheduler.py) | `ManualTaskScheduler`: task scheduler whose delayed calls and blocking work run when the test says so. |
| [test_asyncio_task_scheduler.py](./test_asyncio_task_scheduler.py) | `TestAsyncioTaskScheduler`: settling at shutdown waits for dispatched callbacks and blocking work, up to a timeout. |
| [test_benchmark_catalog.py](./test_benchmark_catalog.py) | `TestBenchmarkCatalog`: the bundled LVIS AP and GFLOPs are read with their split and zero-shot markers, and every listed checkpoint is the weights of a shipped detection preset. |
| [test_background_planner.py](./test_background_planner.py) | `TestBackgroundPlanner`: background recognition covers the shown picture or every picture, the shown media first, frames ahead of a playing video first, and leaves videos to sequential models' users. |
| [test_deferred_save.py](./test_deferred_save.py) | `TestDeferredSave`: coalesced writes, writes during writes, failures, and a write at quit waiting for a running write without being replaced by an older one. |
| [test_embedding.py](./test_embedding.py) | `TestEmbeddingPolicy`, `TestCommandLineEmbedding`: embedding origins and the fixed access token. |
| [test_embedding_routes.py](./test_embedding_routes.py) | `TestEmbeddingRoutes`: parent origins, result documents and framing headers of every response. |
| [test_license_routes.py](./test_license_routes.py) | `TestLicenseRoutes`: YOLO-World and YOLOE presets are marked as needing Ultralytics, refused until its license is accepted, accepted only when installed, remembered once accepted, and chosen without importing it. |
| [test_media_routes.py](./test_media_routes.py) | `TestMediaRoutes`: open videos are served with range requests, other files are refused, `/api/video-frames` answers for an unrecognized video, a playable copy replaces the served video, and a playing video is followed by automatic inference. |
| [test_model_presets.py](./test_model_presets.py) | `TestModelPresets`: every preset of the three model libraries is read, including the promptable, generation and tracking presets, each segmentation mode decides its prompting, segmentation precision overrides reach the library settings, and batch size overrides apply without changing the profile. |
| [test_picture_prompt_routes.py](./test_picture_prompt_routes.py) | `TestPicturePromptRoutes`: exemplar boxes and object marks are drawn, shown and remembered, every segmentation model offers both drawings and says which it reads, classes count their drawings, and mark models refuse to run without marks. |
| [test_picture_prompts.py](./test_picture_prompts.py) | `TestPicturePromptBoard`, `TestDrawnSignature`, `TestStreamPosition`, `TestDrawingPersistence`: drawings follow their class, outdate exactly the pictures depending on them and survive a restart. |
| [test_playback_store.py](./test_playback_store.py) | `TestPlaybackStore`: playable copies are keyed by the source path, size and modification time. |
| [test_result_statistics.py](./test_result_statistics.py) | `TestThresholdCurve`, `TestConfidenceSummary`, `TestSizeBand`, `TestResultStatistics`, `TestProfileComparison`: threshold curves, quantiles, size bands, class relations, picture rankings and the comparison of kept findings. |
| [test_label_annotation_export.py](./test_label_annotation_export.py) | `TestLabelAnnotationExport`: classifications are written as class-column and label-list CSV, Hugging Face imagefolder, Pascal VOC image sets and Open Images labels, with or without scores. |
| [test_label_modes.py](./test_label_modes.py) | `TestLabelModes`: single-label keeps the best class, multi-label every class reaching its minimum, an unchosen mode follows the model, and version 1 rejections move to the best class. |
| [test_review_filter.py](./test_review_filter.py) | `TestReviewFilter`, `TestReviewStores`: phrase minimums replace class ones, the suppression keeps the best box of each class, and both survive a restart. |
| [test_review_routes.py](./test_review_routes.py) | `TestReviewRoutes`: phrase minimums and the suppression are set through the API and reported in the state. |
| [test_segmenter_exemplars.py](./test_segmenter_exemplars.py) | `TestSegmenterExemplars`: SAM 3 reads the exemplar boxes of each picture, and exemplar-only classes are segmented only where they have a positive box. |
| [test_store_round_trips.py](./test_store_round_trips.py) | `TestStoreRoundTrips`: the session, class minimums, duplicate suppression and results archive read back what they wrote. |
| [test_upload_store.py](./test_upload_store.py) | `TestUploadStore`: uploads are streamed to disk, identical content reuses its copy and other content is numbered. |
| [test_weights_storage.py](./test_weights_storage.py) | `TestWeightsStorage`: downloaded weights are found in the Hugging Face hub cache and Ultralytics directories, sized, listed once in order, and deleted. |
| [test_workspace_flow.py](./test_workspace_flow.py) | `TestWorkspaceFlow`: characterization of the state, result, frame, timeline, statistics, comparison, export and restart payloads against `golden/`. |

## Examples

```bash
pip install -e ".[dev]"
pytest
```
