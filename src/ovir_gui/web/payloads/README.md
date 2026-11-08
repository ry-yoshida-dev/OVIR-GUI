# payloads

## Overview

Builders of the JSON documents the routes of `web` answer with, one per part of the page.

## Components

| Component | Description |
| --- | --- |
| [class_view_builder.py](./class_view_builder.py) | `ClassViewBuilder` builds the classes with their reference images, their drawings picture by picture and counts of drawings, saved class sets, class minimums and duplicate suppression. |
| [frame_view_context.py](./frame_view_context.py) | `FrameViewContext` holds what the findings of the pictures of one request are read with. |
| [marked_object.py](./marked_object.py) | `MarkedObject` gathers the class and frames of one object marked on a media file. |
| [model_panel_builder.py](./model_panel_builder.py) | `ModelPanelBuilder` builds the model settings: backends grouped by segmentation mode, presets with their inputs, weights and benchmarks, the drawings of the task and whether the chosen model reads each, the chosen model, devices, precisions and licenses. |
| [page_state_builder.py](./page_state_builder.py) | `PageStateBuilder` builds everything the page shows except result lists. |
| [reply_builder.py](./reply_builder.py) | `ReplyBuilder` builds the answers to actions and the plan of an export. |
| [result_view_builder.py](./result_view_builder.py) | `ResultViewBuilder` builds the findings of a picture or a video, the result table, the timeline and the profile list. |
| [statistics_view_builder.py](./statistics_view_builder.py) | `StatisticsViewBuilder` builds the class, picture and relation statistics and the comparison with another profile. |
