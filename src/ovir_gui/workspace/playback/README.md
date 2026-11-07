# playback

## Overview

Browser-playable copies of open videos: `PlaybackPreparer` encodes them one at a time on a thread of its own, and `PlaybackState` tells whether a video has one.

## Components

| Component | Description |
| --- | --- |
| [preparer.py](./preparer.py) | `PlaybackPreparer` encodes browser-playable copies of open videos one at a time on a thread of its own, stopped on quit, and tells which file to play. |
| [state.py](./state.py) | `PlaybackState` enumerates whether a video has a browser-playable copy. |
