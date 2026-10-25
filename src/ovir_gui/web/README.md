# web

## Overview

FastAPI web server exposing the `workspace` package to a browser: a JSON API under `/api`, a WebSocket at `/api/events` through which `EventHub` (the workspace observer) pushes changes and notices, and the single-page React user interface built into `static/`. `AsyncioTaskScheduler` runs the workspace on the server's event loop, the builders of `payloads/` turn workspace state into JSON documents, and request bodies are validated by the models in `schema/`. Every request passes through `AccessGuard`, which only lets the browser that opened the address printed at start use the server, and every response carries the `frame-ancestors` policy of `FramingHeaders`, so only the server and the parent origins of the `EmbeddingPolicy` may show the interface in a frame. `EmbeddingRoutes` hand polygon documents of the results, built by `ObjectDocumentBuilder`, to embedding pages.

## Components

| Component | Description |
| --- | --- |
| [payloads/](./payloads/README.md) | Builders of the JSON documents describing the workspace to the browser. |
| [schema/](./schema/README.md) | Pydantic request bodies of the JSON API. |
| [static/](./static/) | Built frontend served at `/`, produced from `../../../frontend` with `npm run build`. |
| [access_guard.py](./access_guard.py) | `AccessGuard` is ASGI middleware letting only the browser holding the access token cookie use the server. |
| [asyncio_task_scheduler.py](./asyncio_task_scheduler.py) | `AsyncioTaskScheduler` is the `TaskScheduler` running the workspace on the event loop of the web server. |
| [box_corners.py](./box_corners.py) | `BoxCorners` is a box sent by the browser as `[left, top, right, bottom]`, checked to hold four values. |
| [class_routes.py](./class_routes.py) | `ClassRoutes` handles requests editing classes, phrases, reference images and saved class sets. |
| [connection_kind.py](./connection_kind.py) | `ConnectionKind` enumerates the types of an ASGI connection scope. |
| [directory_browser.py](./directory_browser.py) | `DirectoryBrowser` lists folders and image files on the server so the browser can choose what to open. |
| [embedding_policy.py](./embedding_policy.py) | `EmbeddingPolicy` lists the origins of pages allowed to frame the interface and drive it with `postMessage`. |
| [embedding_routes.py](./embedding_routes.py) | `EmbeddingRoutes` tells the frontend its parent origins and serves polygon documents of the results. |
| [event_hub.py](./event_hub.py) | `EventHub` pushes the changes and notices of the workspace to every connected browser over WebSockets. |
| [export_routes.py](./export_routes.py) | `ExportRoutes` handles requests exporting the stored results and downloading the files the last export wrote. |
| [framing_headers.py](./framing_headers.py) | `FramingHeaders` is ASGI middleware adding the `frame-ancestors` policy to every response. |
| [image_preview.py](./image_preview.py) | `ImagePreview` is an encoded image a browser can display, answered as a response cached for a day. |
| [json_value.py](./json_value.py) | Defines the `JsonValue` and `JsonObject` type aliases of the API payloads. |
| [media_routes.py](./media_routes.py) | `MediaRoutes` handles opening, showing and uploading media, previews, video playback and playable copies, sampling, background recognition and folder listings. |
| [object_document_builder.py](./object_document_builder.py) | `ObjectDocumentBuilder` builds the polygon documents handed to embedding applications. |
| [picture_prompt_routes.py](./picture_prompt_routes.py) | `PicturePromptRoutes` handles drawing exemplar boxes and object marks on the open pictures. |
| [picture_info.py](./picture_info.py) | `PictureInfo` holds the version and upright size of an image file, read without decoding its pixels. |
| [picture_preview_cache.py](./picture_preview_cache.py) | `PicturePreviewCache` caches images and video frames encoded as JPEG for the browser. |
| [recognition_routes.py](./recognition_routes.py) | `RecognitionRoutes` handles reading the state, choosing task and model, accepting licenses of optional modules, running recognitions, and reviewing and comparing results. |
| [reference_draft.py](./reference_draft.py) | `ReferenceDraft` is a reference image waiting for the user to box its examples. |
| [reference_draft_store.py](./reference_draft_store.py) | `ReferenceDraftStore` keeps reference images opened for boxing until they are added to a class or pushed out. |
| [temporary_upload.py](./temporary_upload.py) | `TemporaryUpload` writes a file uploaded with a request to a temporary directory removed after use. |
| [web_application.py](./web_application.py) | `WebApplication` assembles the FastAPI application from the routers, the event WebSocket and the static frontend. |
| [web_context.py](./web_context.py) | `WebContext` holds what the request handlers share: the workspace and the helpers around it. |
| [web_launcher.py](./web_launcher.py) | `WebLauncher` starts the web server and optionally opens the user interface in the default browser. |

## Examples

### Access token

`WebLauncher` prints an address of the form `http://<host>:<port>/?token=<access token>`. `AccessGuard` answers a request carrying the token with an HTTP-only, `SameSite=Lax` cookie and a redirect to the same address without it. Every other request and WebSocket must carry the cookie, and state-changing requests and WebSockets must also come from a page of this server (checked through the `Origin` header).

### HTTP routes

All routes below are prefixed with `/api`.

| Router | Routes |
| --- | --- |
| `MediaRoutes` | `POST /media/open`, `POST /media/close`, `POST /media/show` (answers whether automatic inference follows the playing video), `PUT /sampling`, `PUT /inference`, `POST /inference/retry`, `POST /uploads`, `POST /media/playback`, `GET /media/image?path=`, `GET /media/frame?path=&frame=`, `GET /media/video?path=`, `GET /files?path=` |
| `RecognitionRoutes` | `GET /state`, `GET /results`, `GET /frame?path=&frame=`, `GET /video-frames?path=&after=&until=`, `GET /timeline?path=`, `GET /statistics`, `PUT /task`, `PUT /model`, `PUT /model/preset`, `POST /run`, `POST /run-all`, `POST /update-outdated`, `POST /cancel`, `POST /profiles/select`, `POST /profiles/remove`, `POST /profiles/clear`, `PUT /comparison`, `POST /findings/acceptance`, `PUT /thresholds`, `POST /findings/csv` |
| `ClassRoutes` | `POST /classes/rows`, `PUT /classes/{class_index}/name`, `PUT /classes/{class_index}/phrases/{phrase_index}`, `POST /classes/remove`, `POST /classes/move-phrase`, `POST /classes/move-reference`, `PUT /classes/text`, `POST /classes/clear`, `POST /classes/file`, `GET /references/image`, `POST /references/drafts`, `POST /references/drafts/path`, `POST /references/drafts/current`, `GET /references/drafts/{draft_id}/image`, `POST /references`, `GET /class-sets`, `GET /class-sets/{name}`, `GET /class-sets/{name}/image`, `POST /class-sets/save`, `POST /class-sets/load`, `PUT /class-sets/{name}`, `DELETE /class-sets/{name}`, `POST /class-sets/import`, `GET /class-sets/{name}/file` |
| `PicturePromptRoutes` | `POST /prompts/exemplars`, `POST /prompts/exemplars/remove`, `PUT /prompts/marks`, `POST /prompts/marks/remove`, `POST /prompts/clear` |
| `ExportRoutes` | `GET /export/plan?media=image\|video`, `POST /export/preview`, `POST /export`, `GET /export/download` |
| `EmbeddingRoutes` | `GET /embedding`, `GET /results/document?path=` |
| `WebApplication` | WebSocket `/api/events`; static frontend at `/` (without a `/api` prefix) |

- `GET /api/media/video?path=` streams an open video file with HTTP range support so the browser can play it.
- `GET /api/video-frames?path=` returns the frame payload of every recognized frame of a video, used to draw findings during playback; `after` and `until` limit it to a frame range, so a browser playing a video while it is recognized fetches only the new frames.
- `POST /api/run-all` takes an optional `start_frame`: the shown media comes first, its sampled frames from that frame onward, then the earlier ones and the other media.
- `GET /api/media/image` and `GET /api/media/frame` return JPEG previews from `PicturePreviewCache`, since browsers cannot display every format the models read.
