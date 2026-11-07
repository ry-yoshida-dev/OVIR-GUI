# playback

## Overview

Video playback with findings.

## Components

| Component | Responsibility |
|---|---|
| [CountChart.tsx](CountChart.tsx) | Chart of finding counts along a video. |
| [LivePlaybackGate.tsx](LivePlaybackGate.tsx) | Holds playback just behind a live run. |
| [VideoControls.tsx](VideoControls.tsx) | Playback controls. |
| [VideoFindingsPanel.tsx](VideoFindingsPanel.tsx) | Video findings of the results pane. |
| [VideoResultPlayer.tsx](VideoResultPlayer.tsx) | Video player drawing findings on each frame. |
| [VideoTimeline.tsx](VideoTimeline.tsx) | Seekable timeline. |
| [usePlaybackSync.ts](usePlaybackSync.ts) | Keeps playback, frame results and the shown frame in sync. |
| [useVideoPlayerFallback.ts](useVideoPlayerFallback.ts) | Falls back to server-decoded frames when the browser player fails. |
