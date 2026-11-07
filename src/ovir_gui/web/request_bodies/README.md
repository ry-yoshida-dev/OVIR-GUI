# request_bodies

## Overview

Request bodies of the JSON API, validated by FastAPI before a route handler of the `web` package runs, grouped in one sub-package per route group.

## Components

| Component | Description |
| --- | --- |
| [classes/](./classes/README.md) | Request bodies of `ClassRoutes`: classes, phrases, reference images and class sets. |
| [export/](./export/README.md) | Request bodies of `ExportRoutes`: the export settings and their label-file preview. |
| [media/](./media/README.md) | Request bodies of `MediaRoutes`: opening and showing media, sampling and background inference. |
| [picture_prompts/](./picture_prompts/README.md) | Request bodies of `PicturePromptRoutes`: exemplar boxes and object marks drawn on pictures. |
| [recognition/](./recognition/README.md) | Request bodies of `RecognitionRoutes`: running recognitions, choosing profiles, model settings and review. |
| [box_corners.py](./box_corners.py) | `BoxCorners` is a box sent by the browser as `[left, top, right, bottom]`, checked to hold four values. |
| [path.py](./path.py) | `PathBody` names a file or directory on the server. |
| [picture_findings.py](./picture_findings.py) | `PictureFindings` lists the findings of one picture. |
