# storage

## Overview

Persistence of the application state in a data directory (`ovir_gui_data` by default). It saves named class sets as self-contained `.ovirset` ZIP archives, the stored results of the `results` package as `results.ovirresults` (a JSON manifest plus packed mask bits), per-class confidence thresholds, the label mode of classifications, the text templates saved for classifiers, the exemplar boxes and object marks drawn on pictures, and the session restored at the next start. Results are converted to a detached `ResultsSnapshot` first so they can be written on another thread; results of media files that cannot be reached at start, such as ones on a disconnected drive, are written back unchanged, and an archive that cannot be read is renamed aside instead of being overwritten. Every file is replaced atomically through `AtomicFile`; the JSON stores read and write through `JsonFile` (per-task settings through `TaskSettingsFile`), and the ZIP archives read their manifest through `ZipManifest`. The `workspace` package reads these stores at start and writes them after changes.

## Components

| Component | Description |
| --- | --- |
| [atomic_file.py](./atomic_file.py) | `AtomicFile` replaces a file in one step through a hidden `.<name>.partial` file next to it. |
| [class_set.py](./class_set.py) | `ClassSet` holds classes with every query they are asked with: their phrases and the reference boxes of their image prompts. |
| [class_set_archive.py](./class_set_archive.py) | `ClassSetArchive` reads and writes a class set stored as one self-contained ZIP file. |
| [class_set_entry.py](./class_set_entry.py) | `ClassSetEntry` describes a saved class set as listed in the data directory. |
| [class_set_store.py](./class_set_store.py) | `ClassSetStore` manages the named class sets saved by the user, each one a `ClassSetArchive` at `classes/<name>.ovirset`. |
| [class_set_summary.py](./class_set_summary.py) | `ClassSetSummary` holds counts describing a class set, read from its manifest without decoding any image. |
| [class_threshold_store.py](./class_threshold_store.py) | `ClassThresholdStore` remembers the minimum confidence per task, class and phrase in `class_thresholds.json`. |
| [duplicate_suppression_store.py](./duplicate_suppression_store.py) | `DuplicateSuppressionStore` remembers the review suppression of overlapping boxes per task in `duplicate_suppression.json`. |
| [json_fields.py](./json_fields.py) | `JsonFields` gives typed access to parsed JSON values, raising `TypeError` naming the field on a type mismatch. |
| [json_file.py](./json_file.py) | `JsonFile` reads a JSON object leniently, as absent when missing or unreadable, and writes it atomically. |
| [label_mode_store.py](./label_mode_store.py) | `LabelModeStore` remembers the label mode chosen for classifications in `label_mode.json`. |
| [license_consent_store.py](./license_consent_store.py) | `LicenseConsentStore` remembers the licenses of optional modules the user accepted, and when, in `license_consent.json`. |
| [media_stamp.py](./media_stamp.py) | `MediaStamp` holds the modification time and size a media file had when its results were stored. |
| [picture_prompt_codec.py](./picture_prompt_codec.py) | `PicturePromptCodec` writes and reads exemplar boxes and object marks as JSON, shared by the results archive and the remembered drawings. |
| [picture_prompt_store.py](./picture_prompt_store.py) | `PicturePromptStore` remembers the exemplar boxes and object marks drawn on pictures for every task in `picture_prompts.json`. |
| [playback_store.py](./playback_store.py) | `PlaybackStore` caches browser-playable copies of videos in `playback`, keyed by the source path, size and modification time. |
| [restored_results.py](./restored_results.py) | `RestoredResults` holds the results read back from an archive with the stamps of the media files that could not be reached. |
| [results_archive.py](./results_archive.py) | `ResultsArchive` stores every result in one ZIP file with `manifest.json` and, with masks, `masks.npz`. |
| [results_manifest_reader.py](./results_manifest_reader.py) | `ResultsManifestReader` rebuilds a `ResultLibrary` from a manifest and its mask bits. |
| [results_manifest_writer.py](./results_manifest_writer.py) | `ResultsManifestWriter` converts a `ResultLibrary` into a `ResultsSnapshot` of a JSON manifest and packed mask bits. |
| [results_snapshot.py](./results_snapshot.py) | `ResultsSnapshot` holds every stored result converted for writing, detached from the live results. |
| [results_store.py](./results_store.py) | `ResultsStore` loads and saves the results archive `results.ovirresults` of a data directory, keeping results of unreachable media and setting an unreadable archive aside. |
| [session.py](./session.py) | `Session` describes what the user was working on, restored at the next start. |
| [session_media.py](./session_media.py) | `SessionMedia` holds the open media and shown picture one task had in the session. |
| [session_store.py](./session_store.py) | `SessionStore` remembers the open media, shown picture, sampling, inference and model choices of each task and the chosen task in `session.json`. |
| [session_task_settings.py](./session_task_settings.py) | `SessionTaskSettings` holds the sampling and inference choices one task had in the session. |
| [stored_reference_image.py](./stored_reference_image.py) | `StoredReferenceImage` is a reference image read back from a class set archive with its pixels. |
| [task_settings_file.py](./task_settings_file.py) | `TaskSettingsFile` stores one settings object per task in a JSON file, reading every task on its own. |
| [text_template_store.py](./text_template_store.py) | `TextTemplateStore` remembers the text templates saved for reuse by classifiers in `text_templates.json`. |
| [upload_store.py](./upload_store.py) | `UploadStore` is the default folder `uploads` receiving images and videos sent from a browser, streamed to disk. |
| [zip_manifest.py](./zip_manifest.py) | `ZipManifest` reads a ZIP file described by a JSON manifest, reporting every parse failure as `ValueError`. |
