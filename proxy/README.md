# HTMLCLASS Remote Proxy

Runs the Remote Explorer API and HTTP/WebSocket tunnel.

## Setup

From the **HTMLCLASS repo root** (recommended):

- **`install-proxy.bat`** — `npm install` (proxy uses root `node_modules`)
- **`start-proxy.bat`** — runs `node proxy\index.js` (installs deps first if `node_modules` is missing)

Or manually:

```bash
npm install
npm run proxy
```

Default port **3030** (`PORT` env). Set **`JWT_SECRET`** in production.

**Debug:** set `PROXY_DEBUG=1` or `HTMLCLASS_PROXY_DEBUG=true`, or run **`start-proxy-debug.bat`** from the repo root. Logs each request; `GET /api/remote/status` includes `proxyDebug: true` so the preview client can warn in the Remote Explorer menu.

## Data

`proxy/data/store.json` is created automatically (users + devices). Add `data/` to backups if needed.

## Device registration

Each machine sends `baseUrl` (browser `origin`) so the proxy knows where to forward `/tunnel/:deviceId/...` (e.g. `http://127.0.0.1:3000`).

## Scripts from repo root

After `npm install` inside `proxy/`, from the HTMLCLASS root:

```bash
node proxy/index.js
```

Or add a root npm script that runs this command.
