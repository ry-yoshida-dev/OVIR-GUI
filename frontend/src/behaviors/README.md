# behaviors

## Overview

Reusable logic built on React hooks, with no knowledge of a specific feature.

## Components

| Component | Responsibility |
|---|---|
| [useActionRunner.ts](useActionRunner.ts) | Runs server requests, reporting their errors, and asks before skipping reference-only classes. |
| [useAsyncResource.ts](useAsyncResource.ts) | Loads a value asynchronously per key, dropping stale responses; also an accumulating variant. |
| [useDismiss.ts](useDismiss.ts) | Closes a popup on outside clicks and Escape. |
| [useDraftValue.ts](useDraftValue.ts) | Holds an edited value until it is committed or reset. |
| [useEditableText.ts](useEditableText.ts) | Text typed into a field, starting over whenever the committed text changes. |
| [useKeyedInstance.ts](useKeyedInstance.ts) | Keeps one instance per key, creating a fresh one when the key changes. |
| [useNearViewport.ts](useNearViewport.ts) | Reports whether an element is near the visible area, for lazy loading. |
| [usePointerDrag.ts](usePointerDrag.ts) | Pointer-capture drag handling. |
| [usePreloadedSource.ts](usePreloadedSource.ts) | Preloads an image source and returns it once it is ready. |
| [useStoredState.ts](useStoredState.ts) | React state persisted in browser storage. |
| [useViewportPosition.ts](useViewportPosition.ts) | Positions a popup next to its anchor inside the viewport. |
