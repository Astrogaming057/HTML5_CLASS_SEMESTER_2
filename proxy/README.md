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

## Tunnel body streaming (POST/PUT)

`express.json()` must **not** run on `/tunnel/*` or the request body is consumed before `http-proxy` can forward it — saves and other POSTs would break with **502**. The proxy skips JSON parsing for tunnel paths.

## Tunnel returns 502

The proxy forwards requests to each device’s **`baseUrl`** (set when you register the PC). That URL must be reachable **from the machine running the proxy**, not from your browser.

- If the proxy and HTMLCLASS run on **the same PC**, `http://127.0.0.1:3000` or `http://localhost:3000` is fine.
- If the proxy runs on **another machine**, the registered URL must be **`http://<LAN-IP>:3000`** of the PC that runs HTMLCLASS (e.g. `http://192.168.1.10:3000`). Using `localhost` here makes the proxy connect to **itself**, which causes **502**.

Re-register the device (Remote Explorer → Register This PC) and enter the correct LAN URL. With `PROXY_DEBUG=1`, tunnel errors log to stderr with `ECONNREFUSED` / `ENOTFOUND` hints.

## Device list (online only)

Each registered PC must **POST `/api/devices/heartbeat`** about every 20 seconds (the preview does this while you are logged in). **`GET /api/devices`** only returns devices whose **`lastSeen`** is within **`DEVICE_ONLINE_MS`** (default 90s). Offline machines are hidden until they send a heartbeat again.

## Device registration

Each machine sends `baseUrl` (browser `origin`) so the proxy knows where to forward `/tunnel/:deviceId/...` (e.g. `http://127.0.0.1:3000`).

## Scripts from repo root

After `npm install` inside `proxy/`, from the HTMLCLASS root:

```bash
node proxy/index.js
```

Or add a root npm script that runs this command.
