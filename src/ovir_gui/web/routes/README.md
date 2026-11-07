# routes

## Overview

Request handlers of the JSON API, grouped by what the user does: editing classes, opening and showing media, drawing on pictures, recognizing, exporting and embedding. Each group registers its routes on the FastAPI application with the shared `WebContext`.

## Components

| Component | Description |
| --- | --- |
| [classes.py](./classes.py) | `ClassRoutes` handles requests editing classes, phrases, reference images and saved class sets. |
| [embedding.py](./embedding.py) | `EmbeddingRoutes` tells the frontend its parent origins and serves polygon documents of the results. |
| [export.py](./export.py) | `ExportRoutes` handles requests exporting the stored results and downloading the files the last export wrote. |
| [media.py](./media.py) | `MediaRoutes` handles opening, showing and uploading media, previews, video playback and playable copies, sampling, background recognition and folder listings. |
| [picture_prompts.py](./picture_prompts.py) | `PicturePromptRoutes` handles drawing exemplar boxes and object marks on the open pictures. |
| [recognition.py](./recognition.py) | `RecognitionRoutes` handles reading the state, choosing task and model, accepting licenses of optional modules, listing and deleting downloaded weights, running recognitions, and reviewing and comparing results. |
