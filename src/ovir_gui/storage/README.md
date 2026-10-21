# storage

## Overview

Persistence of the application state in a data directory (`ovir_gui_data` by default). It saves named class sets as self-contained `.ovirset` ZIP archives, the stored results of the `results` package as `results.ovirresults` (a JSON manifest plus packed mask bits), per-class confidence thresholds, the exemplar boxes and object marks drawn on pictures, and the session restored at the next start. Results are converted to a detached `ResultsSnapshot` first so they can be written on another thread. The `workspace` package reads these stores at start and writes them after changes.

## Components

| Component | Description |
| --- | --- |
| [class_set.py](./class_set.py) | `ClassSet` holds classes with every query they are asked with: their phrases and the reference boxes of their image prompts. |
| [class_set_archive.py](./class_set_archive.py) | `ClassSetArchive` reads and writes a class set stored as one self-contained ZIP file. |
| [class_set_entry.py](./class_set_entry.py) | `ClassSetEntry` describes a saved class set as listed in the data directory. |
| [class_set_store.py](./class_set_store.py) | `ClassSetStore` manages the named class sets saved by the user, each one a `ClassSetArchive` at `classes/<name>.ovirset`. |
| [class_set_summary.py](./class_set_summary.py) | `ClassSetSummary` holds counts describing a class set, read from its manifest without decoding any image. |
| [class_threshold_store.py](./class_threshold_store.py) | `ClassThresholdStore` remembers the minimum confidence per task, class and phrase in `class_thresholds.json`. |
| [duplicate_suppression_store.py](./duplicate_suppression_store.py) | `DuplicateSuppressionStore` remembers the review suppression of overlapping boxes per task in `duplicate_suppression.json`. |
| [json_fields.py](./json_fields.py) | `JsonFields` gives typed access to parsed JSON values, raising `TypeError` naming the field on a type mismatch. |
| [picture_prompt_codec.py](./picture_prompt_codec.py) | `PicturePromptCodec` writes and reads exemplar boxes and object marks as JSON, shared by the results archive and the remembered drawings. |
| [picture_prompt_store.py](./picture_prompt_store.py) | `PicturePromptStore` remembers the exemplar boxes and object marks drawn on pictures in `picture_prompts.json`. |
| [results_archive.py](./results_archive.py) | `ResultsArchive` stores every result in one ZIP file with `manifest.json` and, with masks, `masks.npz`. |
| [results_manifest_reader.py](./results_manifest_reader.py) | `ResultsManifestReader` rebuilds a `ResultLibrary` from a manifest and its mask bits. |
| [results_manifest_writer.py](./results_manifest_writer.py) | `ResultsManifestWriter` converts a `ResultLibrary` into a `ResultsSnapshot` of a JSON manifest and packed mask bits. |
| [results_snapshot.py](./results_snapshot.py) | `ResultsSnapshot` holds every stored result converted for writing, detached from the live results. |
| [results_store.py](./results_store.py) | `ResultsStore` loads and saves the results archive `results.ovirresults` of a data directory. |
| [session.py](./session.py) | `Session` describes what the user was working on, restored at the next start. |
| [session_store.py](./session_store.py) | `SessionStore` remembers open media, shown picture, task, sampling and model choices in `session.json`. |
