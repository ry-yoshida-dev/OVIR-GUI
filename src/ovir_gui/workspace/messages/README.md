# messages

## Overview

What the workspace tells the user: `ActionReply` answers a request with an `ActionStatus`, `Notice` reports something that happened at a `NoticeLevel`, and `StatusNotifier` tells every `WorkspaceObserver` which `WorkspaceTopic` changed.

## Components

| Component | Description |
| --- | --- |
| [action_reply.py](./action_reply.py) | `ActionReply` is the answer of the workspace to a request such as Detect, Detect All or Export. |
| [action_status.py](./action_status.py) | `ActionStatus` enumerates how the workspace answered a request of the user. |
| [notice.py](./notice.py) | `Notice` is a message for the user about something that happened, such as a finished run or a failed save. |
| [notice_level.py](./notice_level.py) | `NoticeLevel` enumerates how prominently a notice is shown. |
| [observer.py](./observer.py) | `WorkspaceObserver` is a view following the workspace, always called on the owning thread. |
| [status_notifier.py](./status_notifier.py) | `StatusNotifier` tells the observers what changed and keeps the status and activity messages. |
| [topic.py](./topic.py) | `WorkspaceTopic` enumerates the parts of the workspace a view shows, reported when they change. |
