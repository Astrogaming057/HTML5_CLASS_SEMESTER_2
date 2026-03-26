'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Diff = require('diff');

const TIMELINE_SUBDIR = '.file_timeline';
const STORE_VERSION = 1;
const MAX_EVENTS = 50;
const COLLAPSE_BATCH = 12;
const MAX_PATCH_CHARS = 400000;

const SKIP_TIMELINE_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.svg',
  '.pdf',
  '.zip',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp3',
  '.mp4',
  '.webm',
  '.ogg',
]);

function normalizeRelPath(filePath) {
  return String(filePath || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}

function storeFileName(normalizedPath) {
  const h = crypto.createHash('sha1').update(normalizedPath, 'utf8').digest('hex');
  return h + '.json';
}

function timelineDir(baseDir) {
  return path.join(baseDir, 'ide_editor_cache', TIMELINE_SUBDIR);
}

/**
 * True if path is relative to ide_editor_cache and is internal tooling (not a user's mirrored file).
 * Used e.g. to exclude from "Unsaved in editor cache" in source control.
 */
function isInternalEditorCachePath(relativeFromIdeCacheRoot) {
  const p = normalizeRelPath(relativeFromIdeCacheRoot);
  if (!p) return false;
  return p === TIMELINE_SUBDIR || p.startsWith(TIMELINE_SUBDIR + '/');
}

function storePath(baseDir, normalizedPath) {
  return path.join(timelineDir(baseDir), storeFileName(normalizedPath));
}

function shouldSkipTimeline(filePath) {
  const lower = filePath.toLowerCase();
  for (const ext of SKIP_TIMELINE_EXT) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function patchSummary(unifiedPatch) {
  const lines = String(unifiedPatch || '').split(/\r?\n/);
  let add = 0;
  let del = 0;
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) add++;
    else if (line.startsWith('-') && !line.startsWith('---')) del++;
  }
  if (add === 0 && del === 0) return 'Saved';
  return '-' + del + ' +' + add;
}

async function readStore(baseDir, normalizedPath) {
  const p = storePath(baseDir, normalizedPath);
  try {
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function writeStore(baseDir, store) {
  const normalizedPath = store.path;
  const dir = timelineDir(baseDir);
  await fs.mkdir(dir, { recursive: true });
  const p = storePath(baseDir, normalizedPath);
  await fs.writeFile(p, JSON.stringify(store), 'utf-8');
}

function applyChain(base, events) {
  let cur = base;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev || !ev.patch) continue;
    const next = Diff.applyPatch(cur, ev.patch);
    if (next === false) {
      throw new Error('applyPatch failed at event ' + i);
    }
    cur = next;
  }
  return cur;
}

async function collapseOldest(store) {
  while (store.events.length > MAX_EVENTS) {
    const nCollapse = Math.min(COLLAPSE_BATCH, store.events.length - MAX_EVENTS + COLLAPSE_BATCH);
    const toMerge = store.events.splice(0, nCollapse);
    for (let i = 0; i < toMerge.length; i++) {
      const ev = toMerge[i];
      if (!ev || !ev.patch) continue;
      const next = Diff.applyPatch(store.base, ev.patch);
      if (next === false) {
        store.events = toMerge.slice(i).concat(store.events);
        return;
      }
      store.base = next;
    }
  }
}

/**
 * Append a save event: transforms previous disk content -> new content.
 */
async function appendSaveEvent(baseDir, filePath, oldContent, newContent) {
  const normalizedPath = normalizeRelPath(filePath);
  if (
    !normalizedPath ||
    shouldSkipTimeline(normalizedPath) ||
    normalizedPath.startsWith('ide_editor_cache/')
  ) {
    return { ok: true, skipped: true };
  }

  const oldStr = oldContent == null ? '' : String(oldContent);
  const newStr = newContent == null ? '' : String(newContent);
  if (oldStr === newStr) return { ok: true, unchanged: true };

  let patch = Diff.createTwoFilesPatch(
    normalizedPath,
    normalizedPath,
    oldStr,
    newStr,
    'before save',
    'after save',
    { context: 2 }
  );

  if (patch.length > MAX_PATCH_CHARS) {
    return { ok: true, skipped: true, reason: 'patch_too_large' };
  }

  const verify = Diff.applyPatch(oldStr, patch);
  if (verify === false || verify !== newStr) {
    return { ok: false, error: 'patch_verify_failed' };
  }

  let store = await readStore(baseDir, normalizedPath);
  if (!store) {
    store = {
      v: STORE_VERSION,
      path: normalizedPath,
      base: oldStr,
      events: [],
    };
  } else {
    try {
      const reconstructed = applyChain(store.base, store.events);
      if (reconstructed !== oldStr) {
        store.base = oldStr;
        store.events = [];
      }
    } catch (_e) {
      store.base = oldStr;
      store.events = [];
    }
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const t = Date.now();
  store.events.push({
    id,
    t,
    patch,
    summary: patchSummary(patch),
  });

  await collapseOldest(store);
  await writeStore(baseDir, store);
  return { ok: true, id, t };
}

async function listEvents(baseDir, filePath) {
  const normalizedPath = normalizeRelPath(filePath);
  if (!normalizedPath) return { events: [] };
  const store = await readStore(baseDir, normalizedPath);
  if (!store || !Array.isArray(store.events)) return { events: [] };
  const events = store.events.map((e, idx) => ({
    id: e.id,
    t: e.t,
    summary: e.summary || 'Saved',
    index: idx,
  }));
  return { events: events.reverse() };
}

/** Content after applying events[0]..events[idx] inclusive (idx is 0-based chronological). */
async function reconstructAfterIndex(baseDir, filePath, idx) {
  const normalizedPath = normalizeRelPath(filePath);
  const store = await readStore(baseDir, normalizedPath);
  if (!store || !Array.isArray(store.events)) return { content: null };
  const i = Math.max(0, Math.min(parseInt(idx, 10) || 0, store.events.length - 1));
  const slice = store.events.slice(0, i + 1);
  try {
    const content = applyChain(store.base, slice);
    return { content };
  } catch (_e) {
    return { content: null, error: 'reconstruct_failed' };
  }
}

module.exports = {
  normalizeRelPath,
  shouldSkipTimeline,
  isInternalEditorCachePath,
  appendSaveEvent,
  listEvents,
  reconstructAfterIndex,
  applyChain,
  readStore,
};
