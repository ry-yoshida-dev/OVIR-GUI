# in_memory

## Overview

The latest recognition results held while the application runs, kept per model profile. The `workspace` package updates them and `storage` persists them.

## Components

| Component | Description |
| --- | --- |
| [catalog.py](./catalog.py) | `ResultCatalog` holds the latest result of every recognized image and video frame of one model profile. |
| [library.py](./library.py) | `ResultLibrary` keeps one `ResultCatalog` per model profile, in the order the profiles were added, and scores every classification with the aggregation steps on similarities of the classifier settings. |
| [profile_summary.py](./profile_summary.py) | `ProfileSummary` holds the progress and counts of one profile over the open media. |
| [stored.py](./stored.py) | `StoredResult` is the latest result of one picture with what it was recognized with and the findings the user rejected. |
