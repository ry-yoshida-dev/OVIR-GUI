# storage

## Overview

Persistence of the application state in a data directory (`ovir_gui_data` by default). It saves named class sets as self-contained `.ovirset` ZIP archives, the stored results of the `results` package as `results.ovirresults` (a JSON manifest plus packed mask bits), per-class confidence thresholds, the label mode of classifications, the text templates saved for classifiers, the exemplar boxes and object marks drawn on pictures, and the session restored at the next start. Results are converted to a detached `ResultsSnapshot` first so they can be written on another thread; results of media files that cannot be reached at start, such as ones on a disconnected drive, are written back unchanged, and an archive that cannot be read is renamed aside instead of being overwritten. Every file is replaced atomically through `AtomicFile`; the JSON stores read and write through `JsonFile` (per-task settings through `TaskSettingsFile`), and the ZIP archives read their manifest through `ZipManifest`. The `workspace` package reads these stores at start and writes them after changes.

## Components

| Component | Description |
| --- | --- |
| [class_sets/](./class_sets/README.md) | Saved class sets as self-contained ZIP archives. |
| [picture_prompts/](./picture_prompts/README.md) | Exemplar boxes and object marks drawn on pictures. |
| [results/](./results/README.md) | The results archive with its manifest, snapshot and media stamps. |
| [session/](./session/README.md) | What the user was working on, restored at the next start. |
| [settings/](./settings/README.md) | Review, labeling, license and text template settings remembered between runs. |
| [atomic_file.py](./atomic_file.py) | `AtomicFile` replaces a file in one step through a hidden `.<name>.partial` file next to it. |
| [json_fields.py](./json_fields.py) | `JsonFields` gives typed access to parsed JSON values, raising `TypeError` naming the field on a type mismatch. |
| [json_file.py](./json_file.py) | `JsonFile` reads a JSON object leniently, as absent when missing or unreadable, and writes it atomically. |
| [playback.py](./playback.py) | `PlaybackStore` caches browser-playable copies of videos in `playback`, keyed by the source path, size and modification time. |
| [task_settings_file.py](./task_settings_file.py) | `TaskSettingsFile` stores one settings object per task in a JSON file, reading every task on its own. |
| [uploads.py](./uploads.py) | `UploadStore` is the default folder `uploads` receiving images and videos sent from a browser, streamed to disk. |
| [zip_manifest.py](./zip_manifest.py) | `ZipManifest` reads a ZIP file described by a JSON manifest, reporting every parse failure as `ValueError`. |
