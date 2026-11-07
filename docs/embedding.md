# Embedding protocol

Another web application, such as a GIS, can show the interface in an `<iframe>` of its own page and drive it with
`postMessage`. [examples/embed/index.html](../examples/embed/index.html) is a host page opening the interface in a
movable window.

## Starting the server

Start the server with the origin of the embedding page and a fixed token, so that page knows the address:

```bash
OVIR_GUI_TOKEN=a-long-random-secret ovir-gui --no-browser --embed-origin http://localhost:3000
```

The token needs at least 16 characters, and `--embed-origin` can be repeated for several pages. The page shows
`http://localhost:8000/?token=a-long-random-secret` in an `<iframe>`. Only the listed origins may frame the interface
(`Content-Security-Policy: frame-ancestors`). The access cookie is `SameSite=Lax`, so the embedding page must be on the
same site as the server, e.g. both on `localhost` (mixing `localhost` and `127.0.0.1` does not work).

## Messages

Messages are plain objects sent with `iframe.contentWindow.postMessage(message, serverOrigin)`. A request may carry a
`request_id`; every request is answered with `{type: "ovir-gui:response", request_id, ok, payload | error}`.

| Request | Fields | Effect |
| --- | --- | --- |
| `ovir-gui:open` | `paths`, `show` (optional) | Opens server paths and shows `show` (or the only path) |
| `ovir-gui:show` | `path`, `frame` (optional) | Shows an open picture or video frame |
| `ovir-gui:close` | `paths` | Closes open files |
| `ovir-gui:get-results` | `paths` (optional) | Answers with the kept findings of the shown model |

The interface also posts `ovir-gui:ready` once it listens and `ovir-gui:current-changed` (`path`, `frame`) when
another picture is shown.

## Result document

`ovir-gui:get-results` answers with a document listing pictures with their size and objects:

```json
{
  "format": "ovir-gui-objects", "version": 1, "model": "sam3/litetext_s0",
  "coordinate_space": "pixels of the upright picture (EXIF orientation applied), origin at top-left",
  "pictures": [{"path": "/data/IMG_0012.jpg", "frame": null, "width": 4000, "height": 3000, "objects": [
    {"index": 0, "class_name": "building", "matched_prompt": "building", "confidence": 0.95,
     "box": [1175, 720, 1379, 834], "area": 9374, "polygons": [[[1175, 720], [1379, 722], ...]]}
  ]}]
}
```

`frame` is the frame index of a video and `null` for an image. `matched_prompt` is the prompt of the class that found
the object, or `null` when no single prompt matched it. Polygons are outer rings in pixels of the upright picture and
empty for models without masks; the embedding application maps them onto its own coordinates, e.g. with the
geotransform of an orthophoto.
