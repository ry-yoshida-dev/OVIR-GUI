# results

## Overview

Stored results: `ResultsStore` loads and saves the archive `results.ovirresults`, which `ResultsArchive` writes as a JSON manifest plus packed mask bits. `ResultsManifestWriter` converts the live results into a detached `ResultsSnapshot` so they can be written on another thread, and `ResultsManifestReader` rebuilds them; `MediaStamp` and `RestoredResults` keep results of media files that cannot be reached.

## Components

| Component | Description |
| --- | --- |
| [archive.py](./archive.py) | `ResultsArchive` stores every result in one ZIP file with `manifest.json` and, with masks, `masks.npz`. |
| [manifest_reader.py](./manifest_reader.py) | `ResultsManifestReader` rebuilds a `ResultLibrary` from a manifest and its mask bits. |
| [manifest_writer.py](./manifest_writer.py) | `ResultsManifestWriter` converts a `ResultLibrary` into a `ResultsSnapshot` of a JSON manifest and packed mask bits. |
| [media_stamp.py](./media_stamp.py) | `MediaStamp` holds the modification time and size a media file had when its results were stored. |
| [restored.py](./restored.py) | `RestoredResults` holds the results read back from an archive with the stamps of the media files that could not be reached. |
| [snapshot.py](./snapshot.py) | `ResultsSnapshot` holds every stored result converted for writing, detached from the live results. |
| [store.py](./store.py) | `ResultsStore` loads and saves the results archive `results.ovirresults` of a data directory, keeping results of unreachable media and setting an unreadable archive aside. |
