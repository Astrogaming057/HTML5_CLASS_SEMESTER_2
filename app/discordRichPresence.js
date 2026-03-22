'use strict';

const path = require('path');
const { Client } = require('discord-rpc');

const VSCORD_ICONS_BASE =
  'https://raw.githubusercontent.com/LeonardSSH/vscord/main/assets/icons';

const DEFAULT_ASTRO_SMALL_IMAGE_URL =
  'https://static.astroslounge.com/image/Theisle/deleted/1774217076368.webp';

const DEFAULT_DISCORD_PRESENCE = {
  enabled: false,
  clientId: '782685898163617802',
  appName: 'Astro Code',
  editorIconId: 'vscode',
  idleTimeoutSec: 300,
  showElapsed: true,
  details: 'Editing {file_name}',
  state: '{workspace} · {git_branch} · {lang} · Ln {current_line}, Col {current_column} · {problems_summary}',
  idleDetails: 'Away',
  idleState: '{app_name}',
  largeImageKey: `${VSCORD_ICONS_BASE}/{lang_icon}.png`,
  largeImageText: 'Editing a {Lang} file',
  smallImageKey: DEFAULT_ASTRO_SMALL_IMAGE_URL,
  smallImageText: '{app_name}',
  idleLargeImageKey: `${VSCORD_ICONS_BASE}/idle-{app_id}.png`,
  idleLargeImageText: 'Idling',
  idleSmallImageKey: `${VSCORD_ICONS_BASE}/idle.png`,
  idleSmallImageText: 'zZz',
  button1Label: '',
  button1Url: '',
  button2Label: '',
  button2Url: ''
};

let loadAppConfigFn = () => ({});
let saveAppConfigFn = () => {};

let rpcClient = null;
let rpcConnected = false;
let rpcConnecting = false;
/** True while we intentionally destroy the client (ignore transport `close` from that teardown). */
let rpcIgnoreTransportClose = false;
let lastConfig = null;
let lastPayload = null;
let lastRpcError = null;
let lastSetActivityAt = null;
let lastPresenceSummary = '';

function fixTemplateEncoding(s) {
  if (s == null || typeof s !== 'string') return s;
  let t = s;
  if (t.indexOf('┬╖') !== -1) {
    t = t.replace(/┬╖/g, '·');
  }
  t = t.replace(/\u00c2(?=\s*·)/g, '');
  t = t.replace(/\s*·\s*/g, ' · ');
  return t.trim();
}

function repairDiscordPresenceMerged(merged) {
  const m = { ...merged };
  let changed = false;

  const strKeys = ['details', 'state', 'idleDetails', 'idleState', 'largeImageText', 'smallImageText', 'idleLargeImageText', 'idleSmallImageText'];
  for (const k of strKeys) {
    if (m[k] != null && typeof m[k] === 'string') {
      const fixed = fixTemplateEncoding(m[k]);
      if (fixed !== m[k]) {
        m[k] = fixed;
        changed = true;
      }
    }
  }

  if (typeof m.state === 'string') {
    const st = fixTemplateEncoding(m.state);
    if (st === '{workspace} · {lang}' || st === '{workspace} · {git_branch} · {lang}') {
      m.state = DEFAULT_DISCORD_PRESENCE.state;
      changed = true;
    }
  }

  if (m.enabled && !String(m.clientId || '').trim()) {
    m.clientId = DEFAULT_DISCORD_PRESENCE.clientId;
    changed = true;
  }

  const imageKeys = [
    'largeImageKey',
    'largeImageText',
    'smallImageKey',
    'smallImageText',
    'idleLargeImageKey',
    'idleLargeImageText',
    'idleSmallImageKey',
    'idleSmallImageText'
  ];
  for (const k of imageKeys) {
    if (!String(m[k] || '').trim() && DEFAULT_DISCORD_PRESENCE[k] != null) {
      const def = DEFAULT_DISCORD_PRESENCE[k];
      if (String(def).trim() !== '') {
        m[k] = def;
        changed = true;
      }
    }
  }

  if (!String(m.editorIconId || '').trim()) {
    m.editorIconId = DEFAULT_DISCORD_PRESENCE.editorIconId;
    changed = true;
  }

  const oldVscordSmallTemplate = `${VSCORD_ICONS_BASE}/{app_id}.png`;
  if (String(m.smallImageKey || '').trim() === oldVscordSmallTemplate) {
    m.smallImageKey = DEFAULT_ASTRO_SMALL_IMAGE_URL;
    changed = true;
  }

  return { repaired: m, changed };
}

function getMergedConfig() {
  const saved = loadAppConfigFn().discordPresence || {};
  let merged = { ...DEFAULT_DISCORD_PRESENCE, ...saved };
  const { repaired, changed } = repairDiscordPresenceMerged(merged);
  merged = repaired;
  if (changed) {
    try {
      saveAppConfigFn({ discordPresence: merged });
      console.log('[Discord RPC] Repaired discordPresence in app-config (defaults / encoding)');
    } catch (e) {
      console.error('[Discord RPC] Could not persist repaired discordPresence:', e);
    }
  }
  lastConfig = merged;
  return merged;
}

function persistConfig(partial) {
  const merged = { ...getMergedConfig(), ...partial };
  saveAppConfigFn({ discordPresence: merged });
  lastConfig = merged;
  return merged;
}

function trunc(s, max) {
  const t = String(s == null ? '' : s);
  return t.length <= max ? t : t.slice(0, max - 1) + '…';
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function langIconForVscord(lang) {
  const l = String(lang || 'plaintext').toLowerCase().trim();
const aliases = {
    plaintext: 'text',
    'jsonc': 'json',
    javascript: 'js',
    typescript: 'ts',
    javascriptreact: 'jsx',
    typescriptreact: 'tsx',
    'csharp': 'csharp',
    'fsharp': 'fsharp',
    'c++': 'cpp',
    'c': 'c',
    shellscript: 'shell',
    'shell': 'shell',
    'bat': 'bat',
    'powershell': 'powershell',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'markdown': 'markdown',
    'python': 'python',
    'java': 'java',
    'go': 'go',
    'rust': 'rust',
    'ruby': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'vue': 'vue',
    'xml': 'xml',
    'yaml': 'yaml',
    'dockerfile': 'docker',
    'sql': 'sql'
  };
  const key = aliases[l] || l.replace(/[^a-z0-9_-]/g, '') || 'text';
  return key;
}

function titleCaseLang(lang) {
  const l = String(lang || '').toLowerCase();
  const map = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    javascriptreact: 'JavaScript React',
    typescriptreact: 'TypeScript React',
    plaintext: 'Plain text',
    json: 'JSON',
    jsonc: 'JSON with Comments',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'Less',
    markdown: 'Markdown',
    python: 'Python',
    rust: 'Rust',
    cpp: 'C++',
    csharp: 'C#',
    go: 'Go',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    kotlin: 'Kotlin',
    java: 'Java',
    vue: 'Vue',
    xml: 'XML',
    yaml: 'YAML',
    sql: 'SQL',
    shellscript: 'Shell script',
    powershell: 'PowerShell'
  };
  if (map[l]) return map[l];
  const icon = langIconForVscord(l);
  return capitalize(icon.replace(/[-_]/g, ' '));
}

function buildProblemsSummary(payload) {
  const err = Number(payload && payload.problemErrors) || 0;
  const warn = Number(payload && payload.problemWarnings) || 0;
  const info = Number(payload && payload.problemInfos) || 0;
  const hint = Number(payload && payload.problemHints) || 0;
  if (err === 0 && warn === 0 && info === 0 && hint === 0) {
    return 'No problems';
  }
  const parts = [];
  if (err) parts.push(err + (err === 1 ? ' error' : ' errors'));
  if (warn) parts.push(warn + (warn === 1 ? ' warning' : ' warnings'));
  if (info) parts.push(info + (info === 1 ? ' info' : ' infos'));
  if (hint) parts.push(hint + (hint === 1 ? ' hint' : ' hints'));
  return parts.join(', ');
}

function applyTemplate(template, vars) {
  if (template == null) return '';
  return String(template).replace(/\{([^}]+)\}/g, (_, key) => {
    const k = String(key).trim();
    if (k === 'empty') return ' ';
    if (Object.prototype.hasOwnProperty.call(vars, k)) {
      const v = vars[k];
      return v == null ? '' : String(v);
    }
    return '';
  });
}

function buildVars(cfg, payload) {
  const filePath = (payload && payload.filePath) || '';
  const base = filePath ? path.basename(filePath.replace(/\//g, path.sep)) : '';
  const ext = filePath ? path.extname(base).replace(/^\./, '') : '';
  const currentDir = (payload && payload.currentDir) || '';
  const workspaceFolder = currentDir ? path.basename(currentDir.replace(/\//g, path.sep)) : '';
  const rel = filePath && currentDir
    ? relativeFromDir(currentDir, filePath)
    : filePath;

  const langRaw = (payload && payload.language) || 'plaintext';
  const langLower = String(langRaw).toLowerCase();
  const langIcon = langIconForVscord(langLower);
  const langDisplay = titleCaseLang(langLower);

  const appName = cfg.appName || DEFAULT_DISCORD_PRESENCE.appName;
  const appId = String(cfg.editorIconId || DEFAULT_DISCORD_PRESENCE.editorIconId || 'vscode').trim() || 'vscode';

  const line = payload && payload.line != null ? payload.line : 1;
  const column = payload && payload.column != null ? payload.column : 1;
  const lineCount = payload && payload.lineCount != null ? payload.lineCount : 0;
  const problemsCount = payload && payload.problemsCount != null ? payload.problemsCount : 0;
  const problemErrors = Number(payload && payload.problemErrors) || 0;
  const problemWarnings = Number(payload && payload.problemWarnings) || 0;
  const problemInfos = Number(payload && payload.problemInfos) || 0;
  const problemHints = Number(payload && payload.problemHints) || 0;
  const problemsSummary = buildProblemsSummary(payload);

  const gitBranch = (payload && payload.gitBranch) || '';
  const gitRepo = (payload && payload.gitRepo) || '';

  return {
    app_name: appName,
    file_name: base || 'No file',
    file_extension: ext,
    folder_and_file: rel || base || 'No file',
    relative_file_path: rel,
    workspace: workspaceFolder || 'Workspace',
    workspace_folder: workspaceFolder,
    workspace_and_folder: workspaceFolder,
    lang: langLower,
    lang_icon: langIcon,
    Lang: langDisplay,
    LANG: langDisplay.replace(/\s+/g, '_').toUpperCase(),
    app_id: appId,
    current_line: line,
    current_column: column,
    ln_col: 'Ln ' + line + ', Col ' + column,
    line_col: 'Ln ' + line + ', Col ' + column,
    line_count: lineCount,
    problems_count: problemsCount,
    problems_pluralize: problemsCount === 1 ? 'problem' : 'problems',
    problems_summary: problemsSummary,
    problems_errors: problemErrors,
    problems_warnings: problemWarnings,
    problems_infos: problemInfos,
    problems_hints: problemHints,
    git_branch: gitBranch,
    git_repo: gitRepo,
    git_owner: (payload && payload.gitOwner) || ''
  };
}

function relativeFromDir(dir, filePath) {
  const d = dir.replace(/\\/g, '/').replace(/\/+$/, '');
  let f = filePath.replace(/\\/g, '/');
  if (f.toLowerCase().startsWith(d.toLowerCase() + '/')) {
    return f.slice(d.length + 1);
  }
  return f;
}

function buildButtons(cfg) {
  const out = [];
  const add = (label, url) => {
    const u = String(url || '').trim();
    const l = String(label || '').trim();
    if (!l || !/^https?:\/\//i.test(u)) return;
    out.push({ label: trunc(l, 32), url: u });
  };
  add(cfg.button1Label, cfg.button1Url);
  add(cfg.button2Label, cfg.button2Url);
  return out.length ? out : undefined;
}

/**
 * Socket died or RPC call failed — clear client so the next `pushActivity` reconnects.
 * Keeps `lastPresenceSummary` so the status tooltip can still show the last good line.
 */
function markRpcDisconnected(reason) {
  const msg = reason && String(reason).trim() ? String(reason).trim() : 'connection closed';
  lastRpcError = msg;
  rpcConnected = false;
  rpcConnecting = false;
  const c = rpcClient;
  rpcClient = null;
  if (!c) {
    return;
  }
  (async () => {
    rpcIgnoreTransportClose = true;
    try {
      await c.destroy();
    } catch (_e) {
      /* ignore */
    } finally {
      rpcIgnoreTransportClose = false;
    }
  })();
}

function attachRpcTransportCloseHandler(client) {
  if (!client || !client.transport || typeof client.transport.on !== 'function') {
    return;
  }
  const ref = client;
  client.transport.on('close', () => {
    if (rpcIgnoreTransportClose) {
      return;
    }
    if (rpcClient !== ref) {
      return;
    }
    console.warn('[Discord RPC] IPC transport closed');
    markRpcDisconnected('connection closed');
  });
}

async function disconnect() {
  lastPresenceSummary = '';
  lastRpcError = null;
  rpcIgnoreTransportClose = true;
  try {
    if (rpcClient) {
      try {
        await rpcClient.clearActivity();
      } catch (e) {
        /* ignore */
      }
      try {
        await rpcClient.destroy();
      } catch (e) {
        /* ignore */
      }
      rpcClient = null;
    }
  } finally {
    rpcIgnoreTransportClose = false;
  }
  rpcConnected = false;
  rpcConnecting = false;
}

async function connectIfNeeded() {
  const cfg = getMergedConfig();
  if (!cfg.enabled || !String(cfg.clientId || '').trim()) {
    await disconnect();
    return;
  }
  const id = String(cfg.clientId).trim();
  if (rpcClient && rpcConnected) {
    return;
  }
  await disconnect();
  rpcClient = new Client({ transport: 'ipc' });
  rpcConnecting = true;
  try {
    await rpcClient.login({ clientId: id });
    rpcConnected = true;
    lastRpcError = null;
    attachRpcTransportCloseHandler(rpcClient);
    console.log('[Discord RPC] Connected');
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    lastRpcError = msg;
    console.error('[Discord RPC] Login failed:', msg);
    rpcConnected = false;
    if (rpcClient) {
      try {
        await rpcClient.destroy();
      } catch (err) {
        /* ignore */
      }
      rpcClient = null;
    }
  } finally {
    rpcConnecting = false;
  }
}

function collapseSeparatorNoise(s) {
  return String(s || '')
    .replace(/(?:\s*·\s*){2,}/g, ' · ')
    .replace(/^\s*·\s*/, '')
    .replace(/\s*·\s*$/, '')
    .trim();
}

function composeActivity(cfg, payload) {
  const vars = buildVars(cfg, payload);
  const isIdle = !!(payload && payload.isIdle);

  const detailsTpl = isIdle ? cfg.idleDetails : cfg.details;
  const stateTpl = isIdle ? cfg.idleState : cfg.state;

  const details = trunc(collapseSeparatorNoise(applyTemplate(detailsTpl, vars)), 128);
  const state = trunc(collapseSeparatorNoise(applyTemplate(stateTpl, vars)), 128);

  const act = {
    details: details || undefined,
    state: state || undefined
  };

  const largeTpl =
    isIdle && cfg.idleLargeImageKey != null && String(cfg.idleLargeImageKey).trim() !== ''
      ? cfg.idleLargeImageKey
      : cfg.largeImageKey;
  const smallTpl =
    isIdle && cfg.idleSmallImageKey != null && String(cfg.idleSmallImageKey).trim() !== ''
      ? cfg.idleSmallImageKey
      : cfg.smallImageKey;
  const largeTextTpl = isIdle && cfg.idleLargeImageText != null && cfg.idleLargeImageText !== ''
    ? cfg.idleLargeImageText
    : cfg.largeImageText;
  const smallTextTpl = isIdle && cfg.idleSmallImageText != null && cfg.idleSmallImageText !== ''
    ? cfg.idleSmallImageText
    : cfg.smallImageText;

  const largeKey = applyTemplate(largeTpl, vars).trim();
  const largeText = trunc(applyTemplate(largeTextTpl, vars), 128);
  const smallKey = applyTemplate(smallTpl, vars).trim();
  const smallText = trunc(applyTemplate(smallTextTpl, vars), 128);

  if (largeKey || largeText || smallKey || smallText) {
    act.largeImageKey = largeKey || undefined;
    act.largeImageText = largeText || undefined;
    act.smallImageKey = smallKey || undefined;
    act.smallImageText = smallText || undefined;
  }

  if (cfg.showElapsed && !isIdle) {
    act.startTimestamp = Date.now();
  }

  const buttons = buildButtons(cfg);
  if (buttons) {
    act.buttons = buttons;
  }

  return act;
}

async function pushActivity(payload) {
  const cfg = getMergedConfig();
  if (!cfg.enabled || !String(cfg.clientId || '').trim()) {
    lastPresenceSummary = '';
    lastSetActivityAt = null;
    lastRpcError = null;
    if (rpcClient) {
      try {
        await rpcClient.clearActivity();
      } catch (e) {
        /* ignore */
      }
    }
    return;
  }

  await connectIfNeeded();
  if (!rpcClient || !rpcConnected) {
    return;
  }

  lastPayload = payload;
  const act = composeActivity(cfg, payload);
  try {
    await rpcClient.setActivity(act);
    lastRpcError = null;
    lastSetActivityAt = Date.now();
    const parts = [act.details, act.state].filter(Boolean);
    lastPresenceSummary = parts.join(' · ') || '(presence set)';
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    console.error('[Discord RPC] setActivity failed:', msg);
    markRpcDisconnected(msg);
  }
}

function getDiscordStatusSnapshot() {
  const cfg = getMergedConfig();
  const id = String(cfg.clientId || '').trim();
  return {
    enabled: !!cfg.enabled,
    clientIdConfigured: !!id,
    connected: rpcConnected,
    connecting: rpcConnecting,
    lastError: lastRpcError,
    lastOkAt: lastSetActivityAt,
    lastSummary: lastPresenceSummary
  };
}

function registerIpc(ipcMain, loadAppConfig, saveAppConfig) {
  loadAppConfigFn = loadAppConfig;
  saveAppConfigFn = saveAppConfig;

  ipcMain.handle('discord-get-config', () => {
    const cfg = getMergedConfig();
    return {
      config: cfg,
      connected: rpcConnected,
      ...getDiscordStatusSnapshot()
    };
  });

  ipcMain.handle('discord-get-status', () => getDiscordStatusSnapshot());

  ipcMain.handle('discord-set-config', async (_evt, partial) => {
    const next = persistConfig(typeof partial === 'object' && partial ? partial : {});
    await disconnect();
    if (!next.enabled) {
      lastPresenceSummary = '';
      lastRpcError = null;
      lastSetActivityAt = null;
    }
    const snapshot = {
      config: getMergedConfig(),
      connected: rpcConnected,
      ...getDiscordStatusSnapshot()
    };
    /** Do not await RPC login (can take ~10s on timeout) — settings UI must return immediately. */
    if (next.enabled && String(next.clientId || '').trim()) {
      void (async () => {
        try {
          await connectIfNeeded();
          if (lastPayload) {
            await pushActivity(lastPayload);
          }
        } catch (e) {
          const msg = e && e.message ? e.message : String(e);
          console.error('[Discord RPC] discord-set-config reconnect:', msg);
        }
      })();
    }
    return snapshot;
  });

  ipcMain.handle('discord-update-activity', async (_evt, payload) => {
    await pushActivity(payload && typeof payload === 'object' ? payload : {});
    return { ok: true, ...getDiscordStatusSnapshot() };
  });

  ipcMain.handle('discord-reset-config', async () => {
    const merged = { ...DEFAULT_DISCORD_PRESENCE };
    saveAppConfigFn({ discordPresence: merged });
    lastConfig = merged;
    await disconnect();
    lastPresenceSummary = '';
    lastRpcError = null;
    lastSetActivityAt = null;
    return { config: merged, connected: false, ...getDiscordStatusSnapshot() };
  });
}

async function destroy() {
  await disconnect();
}

module.exports = {
  DEFAULT_DISCORD_PRESENCE,
  registerIpc,
  destroy,
  _pushActivity: pushActivity
};
