# files

## Overview

File primitives the stores read and write through: atomic replacement, lenient JSON objects with typed fields, per-task settings files and ZIP archives described by a manifest. Every file is replaced atomically through `AtomicFile`; the JSON stores read and write through `JsonFile` (per-task settings through `TaskSettingsFile`), and the ZIP archives read their manifest through `ZipManifest`.

## Components

| Component | Description |
| --- | --- |
| [atomic.py](./atomic.py) | `AtomicFile` replaces a file in one step through a hidden `.<name>.partial` file next to it. |
| [json_fields.py](./json_fields.py) | `JsonFields` gives typed access to parsed JSON values, raising `TypeError` naming the field on a type mismatch. |
| [json_object.py](./json_object.py) | `JsonFile` reads a JSON object leniently, as absent when missing or unreadable, and writes it atomically. |
| [task_settings.py](./task_settings.py) | `TaskSettingsFile` stores one settings object per task in a JSON file, reading every task on its own. |
| [zip_manifest.py](./zip_manifest.py) | `ZipManifest` reads a ZIP file described by a JSON manifest, reporting every parse failure as `ValueError`. |
