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
| GET | `/api/devices` | Bearer → **only devices online in the last ~90s** (see heartbeat). |
| POST | `/api/devices/register` | `{ "name", "deviceKey", "baseUrl"? }` — **`baseUrl` must be reachable from the proxy host** (use the LAN IP of the HTMLCLASS PC, not `localhost`, when the proxy runs elsewhere). Otherwise tunnel requests return **502**. |
| POST | `/api/devices/heartbeat` | Bearer + `{ "deviceKey" }` — call from the preview client every ~20s while logged in so the device stays listed. |

## Tunnel (when a remote device is selected)

- HTTP: `GET|POST|PUT|DELETE {PROXY_BASE}/tunnel/{deviceId}/__api__/...` with `Authorization: Bearer <token>`
- WebSocket: `ws(s)://{proxy host}/tunnel/{deviceId}/` (same path prefix as HTTP)

The proxy must forward `/tunnel/:deviceId/*` to the target PC’s HTMLCLASS server and return CORS headers for the browser origin.

## Peer-to-peer

Not implemented in the client; relay via proxy only unless you extend transport.
