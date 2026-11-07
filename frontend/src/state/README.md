# state

## Overview

App-wide state hooks owned by `App` and passed across features.

## Components

| Component | Responsibility |
|---|---|
| [useFramePayload.ts](useFramePayload.ts) | Loads the findings of the shown frame. |
| [useLayoutState.ts](useLayoutState.ts) | Stored pane sizes and collapsed sections. |
| [useResultRows.ts](useResultRows.ts) | Result table rows of the shown results, scoped to the current media or all media. |
| [useShownResults.ts](useShownResults.ts) | Results shown for the current media, combining frame, timeline and video results. |
| [useStatusMessage.ts](useStatusMessage.ts) | Status bar message. |
| [useTaskDisplayOptions.ts](useTaskDisplayOptions.ts) | Stored display options per task. |
| [useTimeline.ts](useTimeline.ts) | Loads a video's result timeline. |
| [useVideoResults.ts](useVideoResults.ts) | Loads and accumulates video frame results around the playback position. |
| [useWorkspace.ts](useWorkspace.ts) | Workspace state from the server, kept current through server events, and notices. |
