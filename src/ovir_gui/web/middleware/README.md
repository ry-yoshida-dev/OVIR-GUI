# middleware

## Overview

ASGI middleware wrapped around the application: `AccessGuard` lets only the browser holding the access token use the server and `FramingHeaders` adds the `frame-ancestors` policy; `ConnectionKind` tells their connection scopes apart.

## Components

| Component | Description |
| --- | --- |
| [access_guard.py](./access_guard.py) | `AccessGuard` is ASGI middleware letting only the browser holding the access token cookie use the server. |
| [connection_kind.py](./connection_kind.py) | `ConnectionKind` enumerates the types of an ASGI connection scope. |
| [framing_headers.py](./framing_headers.py) | `FramingHeaders` is ASGI middleware adding the `frame-ancestors` policy to every response. |
