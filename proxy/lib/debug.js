/**
 * PROXY_DEBUG / ASTRO_CODE_PROXY_DEBUG helpers for WebSocket (wss) logging.
 */

const PROXY_DEBUG =
  process.env.PROXY_DEBUG === '1' ||
  process.env.ASTRO_CODE_PROXY_DEBUG === 'true' ||
  process.env.HTMLCLASS_PROXY_DEBUG === 'true';

function isProxyDebug() {
  return PROXY_DEBUG;
}

function logWss(line) {
  if (PROXY_DEBUG) {
    process.stdout.write('[proxy-wss] ' + line + '\n');
  }
}

/** Hide JWT in ?token= for logs */
function safeUrlForLog(urlStr) {
  if (!urlStr) return '';
  try {
    const u = new URL(urlStr, 'http://x');
    if (u.searchParams.has('token')) {
      u.searchParams.set('token', '[redacted]');
    }
    return u.pathname + u.search + u.hash;
  } catch (e) {
    return String(urlStr).replace(/token=[^&]+/gi, 'token=[redacted]');
  }
}

function summarizeWsPayload(buf) {
  if (buf == null) return 'empty';
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const len = b.length;
  if (len === 0) return 'len=0';
  try {
    const o = JSON.parse(b.toString('utf8'));
    if (o && typeof o.type === 'string') {
      let extra = '';
      if (o.id) extra += ` id=${String(o.id).slice(0, 10)}`;
      if (o.streamId) extra += ` stream=${String(o.streamId).slice(0, 10)}`;
      return `json type=${o.type}${extra} len=${len}`;
    }
  } catch (e) {
    /* binary or non-json */
  }
  const preview = b.toString('utf8').slice(0, 80).replace(/\s+/g, ' ');
  return `len=${len} raw=${preview}${len > 80 ? '…' : ''}`;
}

module.exports = {
  isProxyDebug,
  logWss,
  safeUrlForLog,
  summarizeWsPayload
};
