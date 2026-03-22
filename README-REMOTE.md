# HTMLCLASS Remote Explorer — How the connections work

This document explains the **Remote Explorer** feature: how your browser, the **HTMLCLASS** editor server, the **remote proxy**, and optional **reverse tunnel** fit together. It is written so you can present the design to an instructor or reviewer.

---

## 1. What problem does it solve?

Students (or developers) may run **HTMLCLASS** on one computer (editing files, live preview) but want to **open another machine’s project** from their own browser—similar in spirit to VS Code Remote or a thin “remote workspace” over the network.

Because home networks often use **NAT** (no public IP, no port forwarding), the public internet usually **cannot** initiate a TCP connection *into* a random PC. So we cannot rely only on “the proxy dials the student’s PC at `http://their-ip:3000`.” This project adds a **reverse connection** from the machine that runs HTMLCLASS **outbound** to the proxy, so traffic can flow **through** that existing channel.

---

## 2. Main components

| Component | Role |
|-----------|------|
| **HTMLCLASS Node server** | Local editor API, preview, file I/O. Listens on a port (e.g. `3000`). |
| **Remote proxy** (`proxy/`) | Separate Node app (default port `3030`). Stores **users**, **registered devices**, and **JWT** auth. Exposes HTTP + WebSocket endpoints for tunneling and presence. |
| **Browser (preview UI)** | Runs in the editor. Talks to the **local** HTMLCLASS server for normal work. When “remote” mode is on, it rewrites certain URLs to go **through the proxy** to a chosen **device id**. |
| **Remote agent** (`server/remoteAgent.js`) | Optional **outbound WebSocket** from the HTMLCLASS process to the proxy (`/agent`). Keeps the device “online” and carries **multiplexed** HTTP/WebSocket when direct reachability fails. |

---

## 3. High-level picture (two paths)

### Path A — Direct tunnel (when the proxy can reach the PC)

If the proxy can open **HTTP** (or WebSocket) to the registered **`baseUrl`** (e.g. `http://192.168.1.10:3000` on the LAN), it **forwards** requests:

```text
Browser  --HTTPS-->  Proxy  --HTTP/WS-->  Remote PC (HTMLCLASS :3000)
```

- Browser requests look like: `https://<proxy>/tunnel/<deviceId>/__api__/...`
- The proxy validates the user’s **JWT**, then **proxies** to that device’s `baseUrl`.

### Path B — Reverse tunnel (when direct dial fails)

If the proxy **cannot** reach the PC (NAT, firewall, wrong LAN URL), the **HTMLCLASS server** on that PC opens a **persistent WebSocket** **to** the proxy:

```text
Remote PC (HTMLCLASS)  --WSS /agent-->  Proxy  <--HTTPS--  Browser
```

- The same socket is used for **presence** (who is “online”) and for **application traffic** multiplexed as JSON messages (HTTP request/response and WebSocket frames).
- No inbound port on the student’s router is required for this path.

In practice, **both** may be configured: direct is tried when possible; the **agent** connection is the fallback that makes “no port forwarding” workable.

---

## 4. Authentication

1. User **registers / logs in** on the **proxy** (`/api/auth/*`). The proxy returns a **JWT** signed with `JWT_SECRET`.
2. The browser stores the token (e.g. localStorage) and sends it as **`Authorization: Bearer …`** on API and tunneled **`fetch`** calls.
3. Subresources that **cannot** send custom headers (`<img>`, `<iframe>`, …) append **`?token=<jwt>`** on tunnel URLs; the proxy accepts either form and strips the query parameter before forwarding.

Device registration ties a **`deviceKey`** (per browser install) to a **user account** and stores **`baseUrl`** for direct mode.

---

## 5. End-to-end flow (typical session)

1. User sets **`PROXY_BASE`** in the preview config to the proxy URL (e.g. `http://host:3030`).
2. User signs in via **Remote Explorer** and optionally **registers this PC**.
3. The preview calls **`POST /__api__/remote/agent-config`** on the **local** HTMLCLASS server with `{ proxyUrl, token, deviceKey }`.  
   That makes the **Node process** open **`wss://<proxy>/agent?deviceKey=…`** with the JWT—so the **server**, not only the browser, maintains the reverse link.
4. User selects **remote** and a **target device**. The preview rewrites paths under `/__…` to `/tunnel/<deviceId>/__…` on the proxy.
5. The proxy either **proxies directly** to `baseUrl` or **uses the agent socket** to reach the machine behind NAT.

---

## 6. Important HTTP/WebSocket routes (proxy)

| Route | Purpose |
|-------|---------|
| `/api/auth/*`, `/api/devices/*` | Accounts, device list, registration. |
| `/tunnel/:deviceId/...` | Tunneled editor/preview traffic (after JWT check). |
| `/agent` (WebSocket) | Outbound **agent** from HTMLCLASS server: presence + multiplexed tunnel. |
| WebSocket upgrade on `/tunnel/:deviceId` | Editor WebSocket through tunnel (direct **or** reverse-piped). |

---

## 7. Where to look in the repo

| Area | Location |
|------|----------|
| Proxy app entry | `proxy/index.js` |
| Tunnel HTTP + WS, query `token` | `proxy/lib/tunnel.js` |
| Reverse multiplexing | `proxy/lib/reverseTunnel.js` |
| Agent auth + registration on proxy | `proxy/lib/agentConnection.js` |
| Outbound agent client | `server/remoteAgent.js` |
| Browser push of credentials | `POST /__api__/remote/agent-config` in `server/routes/api.js` |
| URL rewriting in remote mode | `server/templates/js/preview/remote/remoteTransport.js` |
| Proxy operator notes | `proxy/README.md` |

---

## 8. Security notes (for discussion)

- JWTs prove **identity to the proxy**; traffic is **not** end-to-end encrypted beyond TLS to the proxy unless you add extra layers.
- **`?token=`** on URLs can appear in logs or referrers—acceptable for coursework / dev; production would tighten this (short-lived tokens, cookies on same-site, etc.).
- **`JWT_SECRET`** on the proxy must be strong in any shared deployment.

---

## 9. Running it (minimal)

- **HTMLCLASS:** `npm start` (from repo root) — starts the editor server.
- **Proxy:** `npm run proxy` or `node proxy/index.js` — starts the remote service (see `proxy/README.md`).

Set **`PROXY_BASE`** in `server/templates/js/preview/remote/remoteConfig.js` (or your deployment equivalent) to match where the proxy listens.

---

## 10. One-sentence summary

**Remote Explorer** uses a **dedicated proxy** for identity and routing; it supports **classic forward proxying** when the remote PC is reachable, and adds an **outbound WebSocket agent** so the remote HTMLCLASS server can stay reachable **without** inbound port forwarding—making the architecture viable on typical consumer networks.
