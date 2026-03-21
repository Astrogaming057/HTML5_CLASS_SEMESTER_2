# Remote Explorer (client expectations)

The preview UI calls a proxy at `PreviewRemoteConfig.PROXY_BASE` (default `http://192.168.1.69:3030`).

A reference server implementation lives in the repo at **`/proxy`** (see `proxy/README.md`).

**Debug:** `GET /api/remote/status` returns `{ proxyDebug: true }` when the proxy is started with `PROXY_DEBUG=1` (see `start-proxy-debug.bat`). The Remote Explorer dropdown shows a warning when the proxy or local server is in debug mode.

## HTTP API (JSON)

| Method | Path | Body / notes |
|--------|------|----------------|
| POST | `/api/auth/login` | `{ "username", "password" }` → `{ "token" or "accessToken", "user"? }` |
| POST | `/api/auth/register` | Same shape as login |
| GET | `/api/auth/me` | `Authorization: Bearer <token>` |
| GET | `/api/devices` | Bearer → `{ "devices": [ { "id", "name", "deviceKey"? } ] }` |
| POST | `/api/devices/register` | `{ "name", "deviceKey", "baseUrl"? }` — `baseUrl` is the target HTMLCLASS origin (e.g. `http://192.168.x.x:3000`) |

## Tunnel (when a remote device is selected)

- HTTP: `GET|POST|PUT|DELETE {PROXY_BASE}/tunnel/{deviceId}/__api__/...` with `Authorization: Bearer <token>`
- WebSocket: `ws(s)://{proxy host}/tunnel/{deviceId}/` (same path prefix as HTTP)

The proxy must forward `/tunnel/:deviceId/*` to the target PC’s HTMLCLASS server and return CORS headers for the browser origin.

## Peer-to-peer

Not implemented in the client; relay via proxy only unless you extend transport.
