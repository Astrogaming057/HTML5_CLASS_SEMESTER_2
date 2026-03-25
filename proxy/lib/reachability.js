const http = require('http');
const https = require('https');
const { URL } = require('url');

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  if (!u) return '';
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = 'http://' + u;
  }
  return u.replace(/\/$/, '');
}

function isLoopbackHostname(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost');
}

function isLoopbackUrl(url) {
  const t = normalizeBaseUrl(url);
  if (!t) return true;
  try {
    return isLoopbackHostname(new URL(t).hostname);
  } catch (e) {
    return true;
  }
}

function dedupeCandidates(preferredRaw, candidatesArray) {
  const out = [];
  const seen = new Set();
  function add(u) {
    if (u == null || u === '') return;
    const s = String(u).trim();
    if (!s) return;
    const key = s.replace(/\/+$/, '');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  }
  if (Array.isArray(candidatesArray)) {
    for (const c of candidatesArray) add(c);
  }
  add(preferredRaw);
  return out;
}

function probeModeUrl(fullUrl, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(!!ok);
    };
    const timer = setTimeout(() => done(false), Math.max(500, timeoutMs));
    let u;
    try {
      u = new URL(fullUrl);
    } catch (e) {
      clearTimeout(timer);
      done(false);
      return;
    }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(
      u.toString(),
      { timeout: timeoutMs },
      (res) => {
        res.resume();
        clearTimeout(timer);
        done(res.statusCode >= 200 && res.statusCode < 500);
      }
    );
    req.on('error', () => {
      clearTimeout(timer);
      done(false);
    });
    req.on('timeout', () => {
      try {
        req.destroy();
      } catch (e) {
        /* ignore */
      }
      clearTimeout(timer);
      done(false);
    });
  });
}

/**
 * From the proxy host, pick the first reachable Astro Code backend base URL (GET /__api__/mode).
 * Order matches candidate list (LAN first is typical). If none respond, keep the first candidate
 * so direct proxy attempts can still fail over to the reverse tunnel.
 */
async function pickReachableDeviceBase(preferredRaw, candidatesArray, options) {
  const timeoutMs =
    options && Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 2500;
  const list = dedupeCandidates(preferredRaw, candidatesArray);
  const defaultFallback = normalizeBaseUrl(
    process.env.DEFAULT_DEVICE_BASE || 'http://127.0.0.1:17456'
  );

  if (list.length === 0) {
    return defaultFallback;
  }

  const normalizedList = list.map((c) => normalizeBaseUrl(c)).filter(Boolean);
  if (normalizedList.length === 0) {
    return defaultFallback;
  }

  const probeUrls = normalizedList.map((b) => b + '/__api__/mode');
  const results = await Promise.all(probeUrls.map((u) => probeModeUrl(u, timeoutMs)));

  for (let i = 0; i < normalizedList.length; i++) {
    if (results[i]) return normalizedList[i];
  }

  for (const b of normalizedList) {
    if (!isLoopbackUrl(b)) return b;
  }

  return normalizedList[0] || defaultFallback;
}

/** Build http://host:port for probing from a proxy-seen client address (IPv6-safe). */
function buildHttpBaseFromIpPort(ip, port) {
  const p = Number(port);
  if (!ip || !Number.isFinite(p) || p <= 0 || p > 65535) return '';
  let host = String(ip).replace(/^::ffff:/i, '');
  if (!host) return '';
  if (host.includes(':')) host = `[${host}]`;
  return `http://${host}:${p}`;
}

function probeDeviceHttpBase(normalizedBase, timeoutMs) {
  const t = normalizeBaseUrl(normalizedBase);
  if (!t) return Promise.resolve(false);
  const ms =
      timeoutMs !== undefined && timeoutMs !== null && Number(timeoutMs) > 0
        ? Number(timeoutMs)
        : 2500;
  return probeModeUrl(t + '/__api__/mode', ms);
}

module.exports = {
  normalizeBaseUrl,
  isLoopbackUrl,
  pickReachableDeviceBase,
  buildHttpBaseFromIpPort,
  probeDeviceHttpBase
};
