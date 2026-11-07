# web

## Overview

FastAPI web server exposing the `workspace` package to a browser: a JSON API under `/api`, a WebSocket at `/api/events` pushing workspace changes and notices, and the React user interface built into `static/`. Only the browser that opened the address printed at start may use it.

## Components

| Component | Description |
| --- | --- |
| [embedding/](./embedding/README.md) | Origins allowed to embed the interface and the documents handed to them. |
| [middleware/](./middleware/README.md) | ASGI middleware guarding access and setting the framing policy. |
| [payloads/](./payloads/README.md) | Builders of the JSON documents describing the workspace to the browser. |
| [previews/](./previews/README.md) | JPEG previews of images and video frames sent to the browser. |
| [reference_drafts/](./reference_drafts/README.md) | Reference images opened for boxing, kept on the server until added to a class or pushed out. |
| [request_bodies/](./request_bodies/README.md) | Pydantic request bodies of the JSON API. |
| [routes/](./routes/README.md) | Request handlers of the JSON API, one group per area of the interface. |
| [server_files/](./server_files/README.md) | Folder listings and temporary uploads on the server machine for the browser. |
| [workspace_adapters/](./workspace_adapters/README.md) | The workspace's scheduler and observer running on the event loop of the web server. |
| [application.py](./application.py) | `WebApplication` assembles the FastAPI application from the routers, the event WebSocket and the static frontend. |
| [context.py](./context.py) | `WebContext` holds what the request handlers share: the workspace and the helpers around it. |
| [json_object.py](./json_object.py) | Defines the `JsonObject` type alias of the API payloads. |
| [launcher.py](./launcher.py) | `WebLauncher` starts the web server and optionally opens the user interface in the default browser. |
| [static/](./static/) | Built frontend served at `/`, produced from `../../../frontend` with `npm run build`. |
