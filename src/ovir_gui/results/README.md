# results

## Overview

In-memory store of the latest recognition results, kept per model profile. A `ResultLibrary` holds one `ResultCatalog` per profile, and each catalog maps every recognized image and video frame to a `StoredResult` that records the findings, what they were recognized with, and the findings the user rejected. The `workspace` package updates these results, and `storage` persists them to the data directory.

## Components

| Component | Description |
| --- | --- |
| [profile_summary.py](./profile_summary.py) | `ProfileSummary` holds the progress and counts of one profile over the open media. |
| [result_catalog.py](./result_catalog.py) | `ResultCatalog` holds the latest result of every recognized image and video frame of one model profile. |
| [result_library.py](./result_library.py) | `ResultLibrary` keeps one `ResultCatalog` per model profile, in the order the profiles were added, and scores every classification with its template combination. |
| [stored_result.py](./stored_result.py) | `StoredResult` is the latest result of one picture with what it was recognized with and the findings the user rejected. |
