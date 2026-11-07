# workspace_adapters

## Overview

Implementations of the workspace's scheduler and observer protocols running on the web server's event loop: `AsyncioTaskScheduler` runs the work of the workspace, and `EventHub` pushes what the workspace reports to the browsers.

## Components

| Component | Description |
| --- | --- |
| [asyncio_task_scheduler.py](./asyncio_task_scheduler.py) | `AsyncioTaskScheduler` is the `TaskScheduler` running the workspace on the event loop of the web server. |
| [event_hub.py](./event_hub.py) | `EventHub` pushes the changes and notices of the workspace to every connected browser over WebSockets. |
