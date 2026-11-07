# web

## Overview

FastAPI web server exposing the `workspace` package to a browser: a JSON API under `/api`, a WebSocket at `/api/events` through which `EventHub` (the workspace observer) pushes changes and notices, and the single-page React user interface built into `static/`. `AsyncioTaskScheduler` runs the workspace on the server's event loop, the builders of `payloads/` turn workspace state into JSON documents, and request bodies are validated by the models in `request_bodies/`. Every request passes through `AccessGuard`, which only lets the browser that opened the address printed at start use the server, and every response carries the `frame-ancestors` policy of `FramingHeaders`, so only the server and the parent origins of the `EmbeddingPolicy` may show the interface in a frame. `EmbeddingRoutes` hand polygon documents of the results, built by `ObjectDocumentBuilder`, to embedding pages.

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

## Examples

### Access token

`WebLauncher` prints an address of the form `http://<host>:<port>/?token=<access token>`. `AccessGuard` answers a request carrying the token with an HTTP-only, `SameSite=Lax` cookie and a redirect to the same address without it. Every other request and WebSocket must carry the cookie, and state-changing requests and WebSockets must also come from a page of this server (checked through the `Origin` header).

### HTTP routes

All routes below are prefixed with `/api`.

| Router | Routes |
| --- | --- |
| `MediaRoutes` | `POST /media/open`, `POST /media/close`, `POST /media/show` (answers whether automatic inference follows the playing video), `PUT /sampling`, `PUT /inference`, `POST /inference/retry`, `POST /uploads`, `POST /media/playback`, `GET /media/image?path=`, `GET /media/frame?path=&frame=`, `GET /media/video?path=`, `GET /files?path=` |
| `RecognitionRoutes` | `GET /state`, `GET /results`, `GET /frame?path=&frame=`, `GET /video-frames?path=&after=&until=`, `GET /timeline?path=`, `GET /statistics`, `PUT /task`, `PUT /model`, `PUT /model/preset`, `POST /run`, `POST /run-all`, `POST /update-outdated`, `POST /cancel`, `POST /profiles/select`, `POST /profiles/remove`, `POST /profiles/clear`, `PUT /comparison`, `POST /findings/acceptance`, `PUT /thresholds`, `PUT /text-templates`, `POST /findings/csv` |
| `ClassRoutes` | `POST /classes/rows`, `PUT /classes/{class_index}/name`, `PUT /classes/{class_index}/phrases/{phrase_index}`, `POST /classes/remove`, `POST /classes/move-phrase`, `POST /classes/move-reference`, `PUT /classes/text`, `POST /classes/clear`, `POST /classes/file`, `GET /references/image`, `POST /references/drafts`, `POST /references/drafts/path`, `POST /references/drafts/current`, `GET /references/drafts/{draft_id}/image`, `POST /references`, `GET /class-sets`, `GET /class-sets/{name}`, `GET /class-sets/{name}/image`, `POST /class-sets/save`, `POST /class-sets/load`, `PUT /class-sets/{name}`, `DELETE /class-sets/{name}`, `POST /class-sets/import`, `GET /class-sets/{name}/file` |
| `PicturePromptRoutes` | `POST /prompts/exemplars`, `POST /prompts/exemplars/remove`, `PUT /prompts/marks`, `POST /prompts/marks/remove`, `POST /prompts/clear` |
| `ExportRoutes` | `GET /export/plan?media=image\|video`, `POST /export/preview`, `POST /export`, `GET /export/download` |
| `EmbeddingRoutes` | `GET /embedding`, `GET /results/document?path=` |
| `WebApplication` | WebSocket `/api/events`; static frontend at `/` (without a `/api` prefix) |

- `GET /api/media/video?path=` streams an open video file with HTTP range support so the browser can play it.
- `GET /api/video-frames?path=` returns the frame payload of every recognized frame of a video, used to draw findings during playback; `after` and `until` limit it to a frame range, so a browser playing a video while it is recognized fetches only the new frames.
- `POST /api/run-all` takes an optional `start_frame`: the shown media comes first, its sampled frames from that frame onward, then the earlier ones and the other media.
- `GET /api/media/image` and `GET /api/media/frame` return JPEG previews from `PicturePreviewCache`, since browsers cannot display every format the models read.
