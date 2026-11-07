# reference_drafts

## Overview

Reference images opened for boxing, kept on the server until added to a class or pushed out: `ReferenceDraftStore` holds the `ReferenceDraft` of each opened image until the user has boxed its examples.

## Components

| Component | Description |
| --- | --- |
| [draft.py](./draft.py) | `ReferenceDraft` is a reference image waiting for the user to box its examples. |
| [store.py](./store.py) | `ReferenceDraftStore` keeps reference images opened for boxing until they are added to a class or pushed out. |
