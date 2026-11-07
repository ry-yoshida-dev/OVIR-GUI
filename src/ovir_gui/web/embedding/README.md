# embedding

## Overview

Driving the interface from a page that frames it: `EmbeddingPolicy` lists the origins allowed to frame it, and `ObjectDocumentBuilder` builds the polygon documents handed to those pages.

## Components

| Component | Description |
| --- | --- |
| [object_document_builder.py](./object_document_builder.py) | `ObjectDocumentBuilder` builds the polygon documents handed to embedding applications. |
| [policy.py](./policy.py) | `EmbeddingPolicy` lists the origins of pages allowed to frame the interface and drive it with `postMessage`. |
