# class_sets

## Overview

Named class sets saved by the user: `ClassSetStore` keeps each one as a self-contained `.ovirset` ZIP file read and written by `ClassSetArchive`, holding a `ClassSet` with its reference images (`StoredReferenceImage`); `ClassSetEntry` and `ClassSetSummary` describe a saved set without decoding images.

## Components

| Component | Description |
| --- | --- |
| [archive.py](./archive.py) | `ClassSetArchive` reads and writes a class set stored as one self-contained ZIP file. |
| [classes.py](./classes.py) | `ClassSet` holds classes with every query they are asked with: their phrases and the reference boxes of their image prompts. |
| [entry.py](./entry.py) | `ClassSetEntry` describes a saved class set as listed in the data directory. |
| [reference_image.py](./reference_image.py) | `StoredReferenceImage` is a reference image read back from a class set archive with its pixels. |
| [store.py](./store.py) | `ClassSetStore` manages the named class sets saved by the user, each one a `ClassSetArchive` at `classes/<name>.ovirset`. |
| [summary.py](./summary.py) | `ClassSetSummary` holds counts describing a class set, read from its manifest without decoding any image. |
