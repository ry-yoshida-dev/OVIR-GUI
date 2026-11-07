# api

## Overview

Server boundary: the HTTP/WebSocket client and the TypeScript types that mirror the server's API.

## Components

| Component | Responsibility |
|---|---|
| [client.ts](client.ts) | Typed calls to the server's `/api` endpoints and the API error type. |
| [types.ts](types.ts) | Payload and value types matching the server's API, kept in one place. |
