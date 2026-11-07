# storage

## Overview

Persistence of the application state in a data directory (`ovir_gui_data` by default). It saves named class sets as self-contained `.ovirset` ZIP archives, the stored results of the `results` package as `results.ovirresults` (a JSON manifest plus packed mask bits), per-class confidence thresholds, the label mode of classifications, the text templates saved for classifiers, the exemplar boxes and object marks drawn on pictures, and the session restored at the next start. Results are converted to a detached `ResultsSnapshot` first so they can be written on another thread; results of media files that cannot be reached at start, such as ones on a disconnected drive, are written back unchanged, and an archive that cannot be read is renamed aside instead of being overwritten. Every file is written through the primitives of `files`, and uploaded and browser-playable media copies are kept by `media_copies`. The `workspace` package reads these stores at start and writes them after changes.

## Components

| Component | Description |
| --- | --- |
| [class_sets/](./class_sets/README.md) | Saved class sets as self-contained ZIP archives. |
| [files/](./files/README.md) | File primitives the stores read and write through. |
| [media_copies/](./media_copies/README.md) | Copies of media files: browser uploads and browser-playable videos. |
| [picture_prompts/](./picture_prompts/README.md) | Exemplar boxes and object marks drawn on pictures. |
| [results/](./results/README.md) | The results archive with its manifest, snapshot and media stamps. |
| [review/](./review/README.md) | Review criteria remembered between runs: class minimums, duplicate suppression and label mode. |
| [session/](./session/README.md) | What the user was working on, restored at the next start. |
| [license_consent.py](./license_consent.py) | `LicenseConsentStore` remembers the licenses of optional modules the user accepted, and when, in `license_consent.json`. |
| [text_templates.py](./text_templates.py) | `TextTemplateStore` remembers the text templates saved for reuse by classifiers in `text_templates.json`. |
