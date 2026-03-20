/**
 * Hex editor (VS Code Hex Editor–style: offset, hex grid, ASCII, data inspector,
 * undo/redo, selection, copy/cut/paste, minimap, resizable sidebar, zoom).
 * https://github.com/microsoft/vscode-hexeditor
 */
window.PreviewHexEditor = (function() {
  const BYTES_PER_ROW = 16;
  const VIEWPORT_BUFFER = 8;
  const MAX_UNDO = 80;
  const FONT_MIN = 10;
  const FONT_MAX = 22;
  const SIDEBAR_MIN = 180;
  const SIDEBAR_MAX = 520;
  const SIDEBAR_DEFAULT = 260;
  const MINIMAP_W = 14;

  let rowHeight = 22;
  let active = false;
  let mountEl = null;
  let monacoHostEl = null;
  let viewport = null;
  let inner = null;
  let inspectorEl = null;
  let minimapCanvas = null;
  let hexBodyEl = null;
  let sidebarEl = null;
  let pasteTextarea = null;
  let selInfoEl = null;
  let fontLabelEl = null;
  let bytes = null;
  let originalBytes = null;
  let currentPath = '';
  let dirtyCallback = null;
  let reloadTextEditor = null;
  /** Caret / focus end */
  let anchorOffset = 0;
  /** Selection anchor for range (fixed on shift+arrow); selection is [min(anchor,end), max(...)] */
  let selectionAnchor = 0;
  let rafScheduled = false;
  let minimapRaf = false;
  let undoStack = [];
  let redoStack = [];
  let fontPx = 12;
  let sidebarWidthPx = SIDEBAR_DEFAULT;
  let resizingSidebar = false;
  /** true = overwrite from selection start; false = insert before caret (min of selection) */
  let pasteModeReplace = true;
  /** true = parse hex pairs; false = UTF-8 text → bytes */
  let pasteFormatHex = true;
  let dragActive = false;
  let docDragListenersBound = false;
  /** Reflect sidebar control visuals */
  let pasteOptEls = { replace: null, insert: null, hex: null, utf8: null };
  let hexContextMenuEl = null;
  let hexCtxDismissBound = false;
  /** Ignore stray mousedown right after opening context menu */
  let hexCtxOpenTs = 0;

  const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;

  const LS_FONT = 'previewHexEditorFontPx';
  const LS_SIDEBAR = 'previewHexEditorSidebarPx';
  const LS_PASTE_REPLACE = 'previewHexPasteReplace';
  const LS_PASTE_HEX = 'previewHexPasteHex';

  function getUtils() {
    return window.PreviewUtils || null;
  }

  async function hexConfirm(message) {
    const u = getUtils();
    if (u && typeof u.customConfirm === 'function') {
      const r = await u.customConfirm(message, false);
      return r === true;
    }
    try {
      return window.confirm(message);
    } catch (_e) {
      return false;
    }
  }

  async function hexAlert(message) {
    const u = getUtils();
    if (u && typeof u.customAlert === 'function') {
      await u.customAlert(message);
      return;
    }
    try {
      window.alert(message);
    } catch (_e) {
      console.error(message);
    }
  }

  async function hexPromptByte(defaultHex) {
    const u = getUtils();
    if (u && typeof u.customPrompt === 'function') {
      return u.customPrompt('Byte value (hex, e.g. FF or 0xFF)', defaultHex);
    }
    try {
      return window.prompt('Byte value (hex, e.g. FF or 0xFF):', defaultHex);
    } catch (_e) {
      await hexAlert('Cannot open input dialog in this environment.');
      return null;
    }
  }

  async function hexPromptText(title, defaultValue = '') {
    const u = getUtils();
    if (u && typeof u.customPrompt === 'function') {
      return u.customPrompt(title, defaultValue);
    }
    try {
      return window.prompt(title, defaultValue);
    } catch (_e) {
      await hexAlert('Cannot open input dialog in this environment.');
      return null;
    }
  }

  async function clipboardWriteText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_e) {
      await hexAlert('Could not copy to clipboard.');
    }
  }

  async function clipboardReadTextOrNull() {
    try {
      return await navigator.clipboard.readText();
    } catch (_e) {
      await hexAlert('Clipboard read not available.');
      return null;
    }
  }

  function parseOffsetInput(raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return NaN;
    if (/^0x/i.test(s)) return parseInt(s, 16);
    return parseInt(s, 10);
  }

  function hideHexContextMenu() {
    if (hexContextMenuEl) {
      hexContextMenuEl.style.display = 'none';
    }
  }

  /**
   * Close on primary-button mousedown outside the menu only (not document click —
   * that often races with item activation). Ignore events right after open.
   */
  function handleHexCtxPointerDown(e) {
    if (!hexContextMenuEl || hexContextMenuEl.style.display === 'none') return;
    if (e.button !== 0) return;
    if (performance.now() - hexCtxOpenTs < 350) return;
    const t = e.target;
    if (t && hexContextMenuEl.contains(t)) return;
    hideHexContextMenu();
  }

  function bindHexCtxDismiss() {
    if (hexCtxDismissBound) return;
    hexCtxDismissBound = true;
    document.addEventListener('mousedown', handleHexCtxPointerDown, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideHexContextMenu();
    });
  }

  function getSelectionSlice() {
    if (!bytes || bytes.length === 0) return null;
    const { start, end } = getNormalizedSel();
    if (end < start) return null;
    return bytes.subarray(start, end + 1);
  }

  function findAllIndices(findU8) {
    if (!bytes || !findU8 || findU8.length === 0) return [];
    const out = [];
    const n = bytes.length;
    const m = findU8.length;
    for (let i = 0; i <= n - m; i++) {
      let match = true;
      for (let j = 0; j < m; j++) {
        if (bytes[i + j] !== findU8[j]) {
          match = false;
          break;
        }
      }
      if (match) out.push(i);
    }
    return out;
  }

  /**
   * Auto: hex byte runs (with optional spaces / 0x) when the input is only hex symbols;
   * odd-length / invalid hex falls back to UTF-8 of the original text.
   */
  function autoDetectFindBytes(s) {
    const t = String(s == null ? '' : s).trim();
    if (!t) return { error: 'Pattern cannot be empty.' };
    const cleaned = t.replace(/\s+/g, '').replace(/[,;]/g, '').replace(/0x/gi, '');
    const onlyHexSymbols = /^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length > 0;
    if (onlyHexSymbols) {
      const h = parseHexString(t);
      if (h !== null && h.length > 0) {
        return { u8: h, hint: 'hex bytes' };
      }
    }
    if (!textEncoder) return { error: 'TextEncoder not available.' };
    return { u8: textEncoder.encode(t), hint: 'UTF-8 text' };
  }

  function autoDetectReplaceBytes(s) {
    const t = String(s == null ? '' : s);
    if (t.trim() === '') {
      return { u8: new Uint8Array(0), hint: 'remove matches' };
    }
    return autoDetectFindBytes(t);
  }

  /** Non-overlapping scan. Empty repU8 removes matched regions. */
  function replaceAllBytes(findU8, repU8) {
    if (!bytes || !findU8 || findU8.length === 0) return 0;
    let count = 0;
    const chunks = [];
    let i = 0;
    while (i < bytes.length) {
      if (i <= bytes.length - findU8.length) {
        let match = true;
        for (let j = 0; j < findU8.length; j++) {
          if (bytes[i + j] !== findU8[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          if (repU8 && repU8.length > 0) {
            chunks.push(repU8);
          }
          i += findU8.length;
          count++;
          continue;
        }
      }
      chunks.push(bytes.subarray(i, i + 1));
      i++;
    }
    const totalLen = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(totalLen);
    let p = 0;
    for (const c of chunks) {
      out.set(c, p);
      p += c.length;
    }
    beforeMutation();
    bytes = out;
    clampSelection();
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
    return count;
  }

  async function ctxFindAllOccurrences() {
    const findStr = await hexPromptText('Find (auto: hex pairs e.g. DE AD, or any text as UTF-8):', '');
    if (findStr === null) return;
    const det = autoDetectFindBytes(findStr);
    if (det.error || !det.u8) {
      await hexAlert(det.error || 'Invalid pattern.');
      return;
    }
    const idx = findAllIndices(det.u8);
    if (idx.length === 0) {
      await hexAlert(`No matches (interpreted as ${det.hint}).`);
      return;
    }
    const preview = idx.slice(0, 36).map((i) => `0x${padHex(i, 8)} (${i})`).join('\n');
    let msg = `Found ${idx.length} × (${det.hint}).\n${preview}`;
    if (idx.length > 36) msg += `\n… +${idx.length - 36} more`;
    await hexAlert(msg);
    const first = idx[0];
    selectionAnchor = anchorOffset = first;
    updateInspector();
    updateSelInfo();
    scheduleRender();
    scheduleMinimap();
    if (viewport) {
      const row = Math.floor(first / BYTES_PER_ROW);
      viewport.scrollTop = Math.max(0, row * rowHeight - viewport.clientHeight / 2);
      viewport.focus();
    }
  }

  async function ctxReplaceAllOccurrences() {
    const findStr = await hexPromptText('Find (auto: hex or UTF-8 — same as Find all):', '');
    if (findStr === null) return;
    const detF = autoDetectFindBytes(findStr);
    if (detF.error || !detF.u8) {
      await hexAlert(detF.error || 'Invalid find pattern.');
      return;
    }
    const repStr = await hexPromptText(
      `Replace with (auto: hex or UTF-8; empty = delete each match — find was ${detF.hint}):`,
      ''
    );
    if (repStr === null) return;
    const detR = autoDetectReplaceBytes(repStr);
    if (detR.error || !detR.u8) {
      await hexAlert(detR.error || 'Invalid replace pattern.');
      return;
    }
    const n = replaceAllBytes(detF.u8, detR.u8);
    await hexAlert(
      n > 0
        ? `Done: ${n} occurrence(s) updated.\nFind: ${detF.hint} → Replace: ${detR.hint}`
        : `No matches (${detF.hint}).`
    );
  }

  async function ctxPasteClipboardReplace() {
    const text = await clipboardReadTextOrNull();
    if (text === null) return;
    const { ok, u8, error } = decodePasteInput(text);
    if (!ok) {
      await hexAlert(error || 'Invalid clipboard for current Hex/UTF-8 mode.');
      return;
    }
    if (u8.length === 0) return;
    const { start } = getNormalizedSel();
    pasteBytesAt(start, u8);
  }

  async function ctxPasteClipboardInsert() {
    const text = await clipboardReadTextOrNull();
    if (text === null) return;
    const { ok, u8, error } = decodePasteInput(text);
    if (!ok) {
      await hexAlert(error || 'Invalid clipboard for current Hex/UTF-8 mode.');
      return;
    }
    if (u8.length === 0) return;
    const pos = Math.min(selectionAnchor, anchorOffset);
    insertBytesAt(pos, u8);
  }

  async function ctxCopyHexCompact() {
    const slice = getSelectionSlice();
    if (!slice || slice.length === 0) return;
    let s = '';
    for (let i = 0; i < slice.length; i++) s += padHex(slice[i], 2);
    await clipboardWriteText(s);
  }

  async function ctxCopyBase64() {
    const slice = getSelectionSlice();
    if (!slice || slice.length === 0) return;
    await clipboardWriteText(bytesToBase64(slice));
  }

  async function ctxCopyUtf8() {
    if (!textDecoder) {
      await hexAlert('TextDecoder not available.');
      return;
    }
    const slice = getSelectionSlice();
    if (!slice || slice.length === 0) return;
    await clipboardWriteText(textDecoder.decode(slice));
  }

  async function ctxCopyCArray() {
    const slice = getSelectionSlice();
    if (!slice || slice.length === 0) return;
    const parts = [];
    for (let i = 0; i < slice.length; i++) {
      parts.push('0x' + padHex(slice[i], 2));
    }
    await clipboardWriteText('{ ' + parts.join(', ') + ' }');
  }

  async function ctxCopyJavaBytes() {
    const slice = getSelectionSlice();
    if (!slice || slice.length === 0) return;
    const parts = [];
    for (let i = 0; i < slice.length; i++) {
      parts.push('(byte) 0x' + padHex(slice[i], 2));
    }
    await clipboardWriteText('new byte[] { ' + parts.join(', ') + ' }');
  }

  async function ctxCopyPythonFromhex() {
    const slice = getSelectionSlice();
    if (!slice || slice.length === 0) return;
    let h = '';
    for (let i = 0; i < slice.length; i++) h += padHex(slice[i], 2).toLowerCase();
    await clipboardWriteText("bytes.fromhex('" + h + "')");
  }

  async function ctxCopyRustArray() {
    const slice = getSelectionSlice();
    if (!slice || slice.length === 0) return;
    const parts = [];
    for (let i = 0; i < slice.length; i++) {
      parts.push('0x' + padHex(slice[i], 2));
    }
    await clipboardWriteText('&[' + parts.join(', ') + ']');
  }

  async function ctxCopyOffsetInfo() {
    const slice = getSelectionSlice();
    if (!slice || slice.length === 0) return;
    const { start, end } = getNormalizedSel();
    await clipboardWriteText(`offset=0x${padHex(start, 8)} len=${end - start + 1}`);
  }

  function fillSelectionWith(value) {
    if (!bytes || bytes.length === 0) return;
    const { start, end } = getNormalizedSel();
    if (end < start) return;
    beforeMutation();
    const v = value & 0xff;
    for (let i = start; i <= end; i++) {
      bytes[i] = v;
    }
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
  }

  function invertSelectionBytes() {
    if (!bytes || bytes.length === 0) return;
    const { start, end } = getNormalizedSel();
    if (end < start) return;
    beforeMutation();
    for (let i = start; i <= end; i++) {
      bytes[i] ^= 0xff;
    }
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
  }

  function reverseSelectionBytes() {
    if (!bytes || bytes.length === 0) return;
    const { start, end } = getNormalizedSel();
    if (end < start) return;
    beforeMutation();
    let lo = start;
    let hi = end;
    while (lo < hi) {
      const t = bytes[lo];
      bytes[lo] = bytes[hi];
      bytes[hi] = t;
      lo++;
      hi--;
    }
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
  }

  function randomizeSelection() {
    if (!bytes || bytes.length === 0) return;
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
      void hexAlert('crypto.getRandomValues not available.');
      return;
    }
    const { start, end } = getNormalizedSel();
    if (end < start) return;
    beforeMutation();
    const len = end - start + 1;
    const tmp = new Uint8Array(len);
    crypto.getRandomValues(tmp);
    for (let i = start; i <= end; i++) {
      bytes[i] = tmp[i - start];
    }
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
  }

  async function ctxGoToOffset() {
    const raw = await hexPromptText('Go to offset (decimal or 0xhex):', '0');
    if (raw === null) return;
    const off = parseOffsetInput(raw);
    if (Number.isNaN(off) || off < 0) {
      await hexAlert('Invalid offset.');
      return;
    }
    if (!bytes || bytes.length === 0) return;
    const max = Math.max(0, bytes.length - 1);
    const o = Math.min(off, max);
    selectionAnchor = anchorOffset = o;
    updateInspector();
    updateSelInfo();
    scheduleRender();
    scheduleMinimap();
    if (viewport) {
      const row = Math.floor(o / BYTES_PER_ROW);
      viewport.scrollTop = Math.max(0, row * rowHeight - viewport.clientHeight / 2);
      viewport.focus();
    }
  }

  async function ctxInsertZeroBytes() {
    const raw = await hexPromptText('Insert N bytes of 0x00 at caret:', '1');
    if (raw === null) return;
    const n = parseInt(String(raw).trim(), 10);
    if (Number.isNaN(n) || n < 1 || n > 1e7) {
      await hexAlert('Enter a count between 1 and 10000000.');
      return;
    }
    const buf = new Uint8Array(n);
    const pos = Math.min(selectionAnchor, anchorOffset);
    insertBytesAt(pos, buf);
  }

  function duplicateSelectionAtCaret() {
    if (!bytes || bytes.length === 0) return;
    const { start, end } = getNormalizedSel();
    if (end < start) return;
    const slice = bytes.subarray(start, end + 1);
    const copy = new Uint8Array(slice);
    const pos = Math.min(selectionAnchor, anchorOffset);
    insertBytesAt(pos, copy);
  }

  async function ctxCopyHexWordsLE() {
    const slice = getSelectionSlice();
    if (!slice || slice.length === 0) return;
    const words = [];
    for (let i = 0; i + 3 < slice.length; i += 4) {
      const v = slice[i] | (slice[i + 1] << 8) | (slice[i + 2] << 16) | (slice[i + 3] << 24);
      words.push('0x' + padHex(v >>> 0, 8));
    }
    if (words.length === 0) {
      await hexAlert('Need at least 4 bytes for uint32 words.');
      return;
    }
    await clipboardWriteText(words.join(', '));
  }

  function padHex(n, w) {
    return n.toString(16).toUpperCase().padStart(w, '0');
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }

  function bytesToBase64(u8) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      bin += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + chunk, u8.length)));
    }
    return btoa(bin);
  }

  function loadPrefs() {
    try {
      const f = parseInt(localStorage.getItem(LS_FONT) || '', 10);
      if (f >= FONT_MIN && f <= FONT_MAX) fontPx = f;
      const s = parseInt(localStorage.getItem(LS_SIDEBAR) || '', 10);
      if (s >= SIDEBAR_MIN && s <= SIDEBAR_MAX) sidebarWidthPx = s;
      const pr = localStorage.getItem(LS_PASTE_REPLACE);
      if (pr === '0') pasteModeReplace = false;
      if (pr === '1') pasteModeReplace = true;
      const ph = localStorage.getItem(LS_PASTE_HEX);
      if (ph === '0') pasteFormatHex = false;
      if (ph === '1') pasteFormatHex = true;
    } catch (_e) { /* ignore */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(LS_FONT, String(fontPx));
      localStorage.setItem(LS_SIDEBAR, String(sidebarWidthPx));
      localStorage.setItem(LS_PASTE_REPLACE, pasteModeReplace ? '1' : '0');
      localStorage.setItem(LS_PASTE_HEX, pasteFormatHex ? '1' : '0');
    } catch (_e) { /* ignore */ }
  }

  function syncPasteChrome() {
    if (pasteOptEls.replace) {
      pasteOptEls.replace.classList.toggle('hex-opt-on', pasteModeReplace);
      pasteOptEls.insert.classList.toggle('hex-opt-on', !pasteModeReplace);
    }
    if (pasteOptEls.hex) {
      pasteOptEls.hex.classList.toggle('hex-opt-on', pasteFormatHex);
      pasteOptEls.utf8.classList.toggle('hex-opt-on', !pasteFormatHex);
    }
    if (pasteTextarea) {
      pasteTextarea.placeholder = pasteFormatHex
        ? 'Hex: DE AD BE EF or deadbeef …'
        : 'Plain text — pasted as UTF-8 bytes (emoji & Unicode OK)';
    }
    updateSelInfo();
  }

  function decodePasteInput(raw) {
    const s = raw == null ? '' : String(raw);
    if (pasteFormatHex) {
      const parsed = parseHexString(s);
      if (parsed === null) {
        return { ok: false, u8: null, error: 'Invalid hex (pairs of 0-9 A-F).' };
      }
      return { ok: true, u8: parsed, error: null };
    }
    if (!textEncoder) {
      return { ok: false, u8: null, error: 'TextEncoder not available.' };
    }
    return { ok: true, u8: textEncoder.encode(s), error: null };
  }

  function pickByteOffsetFromPoint(clientX, clientY) {
    if (!viewport || !bytes || bytes.length === 0) return null;
    const rect = viewport.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }
    const el = document.elementFromPoint(clientX, clientY);
    if (!el || !viewport.contains(el)) return null;
    const node = el.closest && el.closest('[data-offset]');
    if (!node || !viewport.contains(node)) return null;
    const o = parseInt(node.dataset.offset, 10);
    if (Number.isNaN(o) || o < 0 || o >= bytes.length) return null;
    return o;
  }

  function handleHexDocMouseMove(e) {
    if (!dragActive || !active) return;
    const o = pickByteOffsetFromPoint(e.clientX, e.clientY);
    if (o !== null && o !== anchorOffset) {
      anchorOffset = o;
      updateInspector();
      updateSelInfo();
      scheduleRender();
      scheduleMinimap();
    }
  }

  function handleHexDocMouseUp() {
    dragActive = false;
  }

  function bindHexDocDragListenersOnce() {
    if (docDragListenersBound) return;
    docDragListenersBound = true;
    document.addEventListener('mousemove', handleHexDocMouseMove);
    document.addEventListener('mouseup', handleHexDocMouseUp);
  }

  function beginCellPointer(ev, i) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    dragActive = true;
    if (viewport) viewport.focus();
    if (ev.shiftKey) {
      anchorOffset = i;
    } else {
      selectionAnchor = i;
      anchorOffset = i;
    }
    updateInspector();
    updateSelInfo();
    scheduleRender();
    scheduleMinimap();
  }

  function applyFontScale() {
    if (mountEl) {
      mountEl.style.setProperty('--hex-font-size', fontPx + 'px');
    }
    rowHeight = Math.max(18, Math.round(fontPx * 1.65));
    if (fontLabelEl) {
      fontLabelEl.textContent = fontPx + 'px';
    }
  }

  function getNormalizedSel() {
    const a = selectionAnchor;
    const b = anchorOffset;
    return a <= b ? { start: a, end: b } : { start: b, end: a };
  }

  function setCaret(off, extendSelection) {
    if (!bytes || bytes.length === 0) return;
    off = Math.max(0, Math.min(off, bytes.length - 1));
    if (extendSelection) {
      anchorOffset = off;
    } else {
      selectionAnchor = off;
      anchorOffset = off;
    }
    updateInspector();
    updateSelInfo();
    scheduleRender();
    scheduleMinimap();
  }

  function selectAll() {
    if (!bytes || bytes.length === 0) return;
    selectionAnchor = 0;
    anchorOffset = bytes.length - 1;
    updateInspector();
    updateSelInfo();
    scheduleRender();
    scheduleMinimap();
  }

  function updateSelInfo() {
    if (!selInfoEl) return;
    const modeLine = `Paste: ${pasteModeReplace ? 'Replace' : 'Insert'} · ${pasteFormatHex ? 'Hex' : 'UTF-8'}`;
    if (!bytes || bytes.length === 0) {
      selInfoEl.textContent = 'No data\n' + modeLine;
      return;
    }
    const { start, end } = getNormalizedSel();
    const len = end - start + 1;
    selInfoEl.textContent =
      `Sel 0x${padHex(start, 8)}–0x${padHex(end, 8)} (${len} byte${len !== 1 ? 's' : ''})\n` + modeLine;
  }

  function computeDirty() {
    if (!bytes || !originalBytes) return false;
    if (bytes.length !== originalBytes.length) return true;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== originalBytes[i]) return true;
    }
    return false;
  }

  function notifyDirty() {
    if (typeof dirtyCallback === 'function') {
      dirtyCallback(computeDirty());
    }
  }

  function isActive() {
    return active;
  }

  function isDirty() {
    return computeDirty();
  }

  function cloneState() {
    return new Uint8Array(bytes);
  }

  function beforeMutation() {
    if (!bytes) return;
    undoStack.push(cloneState());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
  }

  function undo() {
    if (!bytes || undoStack.length === 0) return;
    redoStack.push(cloneState());
    bytes = undoStack.pop();
    clampSelection();
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
  }

  function redo() {
    if (!bytes || redoStack.length === 0) return;
    undoStack.push(cloneState());
    bytes = redoStack.pop();
    clampSelection();
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
  }

  function clampSelection() {
    if (!bytes || bytes.length === 0) {
      selectionAnchor = anchorOffset = 0;
      return;
    }
    const max = bytes.length - 1;
    selectionAnchor = Math.max(0, Math.min(selectionAnchor, max));
    anchorOffset = Math.max(0, Math.min(anchorOffset, max));
  }

  function updateInspector() {
    if (!inspectorEl || !bytes || bytes.length === 0) return;
    const o = Math.max(0, Math.min(anchorOffset, bytes.length - 1));
    const b = bytes[o];
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const d = new DataView(buf);
    let parts = [
      `<span class="hex-insp-item"><span class="hex-insp-k">Offset</span> 0x${padHex(o, 8)} (${o})</span>`,
      `<span class="hex-insp-item"><span class="hex-insp-k">Uint8</span> ${b}</span>`,
      `<span class="hex-insp-item"><span class="hex-insp-k">Int8</span> ${(b << 24) >> 24}</span>`
    ];
    if (o + 1 < bytes.length) {
      parts.push(`<span class="hex-insp-item"><span class="hex-insp-k">Uint16 LE</span> ${d.getUint16(o, true)}</span>`);
    }
    if (o + 3 < bytes.length) {
      parts.push(`<span class="hex-insp-item"><span class="hex-insp-k">Uint32 LE</span> ${d.getUint32(o, true)}</span>`);
    }
    if (o + 7 < bytes.length) {
      parts.push(`<span class="hex-insp-item"><span class="hex-insp-k">Float64 LE</span> ${d.getFloat64(o, true)}</span>`);
    }
    inspectorEl.innerHTML = parts.join('');
  }

  function setByteAt(offset, value) {
    if (!bytes || offset < 0 || offset >= bytes.length) return;
    const v = value & 0xff;
    if (bytes[offset] === v) return;
    beforeMutation();
    bytes[offset] = v;
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
  }

  function parseHexString(s) {
    if (!s || !String(s).trim()) return new Uint8Array(0);
    const cleaned = String(s).replace(/\s+/g, '').replace(/[,;]/g, '').replace(/0x/gi, '');
    if (cleaned.length % 2 !== 0) return null;
    const out = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < out.length; i++) {
      const byte = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
      if (Number.isNaN(byte)) return null;
      out[i] = byte;
    }
    return out;
  }

  function bytesToHexSpaced(u8) {
    const parts = [];
    for (let i = 0; i < u8.length; i++) {
      parts.push(padHex(u8[i], 2));
    }
    return parts.join(' ');
  }

  /** Overwrite from `start` with `u8`; grow file if needed */
  function pasteBytesAt(start, u8) {
    if (!bytes || !u8 || u8.length === 0) return;
    start = Math.max(0, start);
    beforeMutation();
    const end = start + u8.length;
    if (end <= bytes.length) {
      bytes.set(u8, start);
    } else {
      const grown = new Uint8Array(end);
      grown.set(bytes.subarray(0, start), 0);
      grown.set(u8, start);
      bytes = grown;
    }
    anchorOffset = Math.min(start + u8.length - 1, Math.max(0, bytes.length - 1));
    selectionAnchor = start;
    clampSelection();
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
  }

  /** Insert `u8` so byte at `index` shifts right (file grows). */
  function insertBytesAt(index, u8) {
    if (!bytes || !u8 || u8.length === 0) return;
    index = Math.max(0, Math.min(index, bytes.length));
    beforeMutation();
    const oldLen = bytes.length;
    const out = new Uint8Array(oldLen + u8.length);
    out.set(bytes.subarray(0, index), 0);
    out.set(u8, index);
    if (index < oldLen) {
      out.set(bytes.subarray(index), index + u8.length);
    }
    bytes = out;
    const endIns = index + u8.length - 1;
    selectionAnchor = index;
    anchorOffset = Math.max(index, endIns);
    clampSelection();
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
  }

  /** Uses sidebar Replace/Insert + selection/caret. */
  function applyPasteBytes(u8) {
    if (!bytes || !u8 || u8.length === 0) return;
    if (pasteModeReplace) {
      const { start } = getNormalizedSel();
      pasteBytesAt(start, u8);
    } else {
      const pos = Math.min(selectionAnchor, anchorOffset);
      insertBytesAt(pos, u8);
    }
  }

  async function copySelectionHex() {
    const { start, end } = getNormalizedSel();
    if (!bytes || end < start) return;
    const slice = bytes.subarray(start, end + 1);
    const text = bytesToHexSpaced(slice);
    try {
      await navigator.clipboard.writeText(text);
    } catch (_e) {
      await hexAlert('Could not copy to clipboard.');
    }
  }

  async function cutSelection() {
    const { start, end } = getNormalizedSel();
    if (!bytes || end < start) return;
    const slice = bytes.subarray(start, end + 1);
    const text = bytesToHexSpaced(slice);
    try {
      await navigator.clipboard.writeText(text);
    } catch (_e) {
      await hexAlert('Could not copy to clipboard.');
      return;
    }
    beforeMutation();
    for (let i = start; i <= end; i++) {
      bytes[i] = 0;
    }
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
  }

  function deleteSelectionOrByte(forward) {
    if (!bytes || bytes.length === 0) return;
    const { start, end } = getNormalizedSel();
    if (start !== end) {
      beforeMutation();
      for (let i = start; i <= end; i++) {
        bytes[i] = 0;
      }
    } else {
      const i = forward ? anchorOffset : Math.max(0, anchorOffset - 1);
      if (i < 0 || i >= bytes.length) return;
      beforeMutation();
      bytes[i] = 0;
      if (!forward && anchorOffset > 0) {
        setCaret(anchorOffset - 1, false);
      }
      notifyDirty();
      scheduleRender();
      scheduleMinimap();
      updateInspector();
      updateSelInfo();
      return;
    }
    notifyDirty();
    scheduleRender();
    scheduleMinimap();
    updateInspector();
    updateSelInfo();
  }

  function scheduleRender() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      renderViewport();
    });
  }

  function scheduleMinimap() {
    if (minimapRaf) return;
    minimapRaf = true;
    requestAnimationFrame(() => {
      minimapRaf = false;
      drawMinimap();
    });
  }

  function syncMinimapSize() {
    if (!minimapCanvas || !viewport) return;
    const wrap = minimapCanvas.parentElement;
    if (!wrap) return;
    const h = wrap.clientHeight || 1;
    minimapCanvas.width = MINIMAP_W;
    minimapCanvas.height = h;
    drawMinimap();
  }

  function drawMinimap() {
    if (!minimapCanvas || !bytes || !viewport) return;
    const ctx = minimapCanvas.getContext('2d');
    if (!ctx) return;
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const len = bytes.length;
    if (len === 0 || h < 1) return;
    const { start, end } = getNormalizedSel();
    for (let py = 0; py < h; py++) {
      const bo = Math.min(len - 1, Math.floor((py / h) * len));
      const byte = bytes[bo];
      const orig = originalBytes && bo < originalBytes.length ? originalBytes[bo] : byte;
      let R = 48;
      let G = 52;
      let B = 72;
      if (byte !== orig) {
        R = 210;
        G = 140;
        B = 55;
      }
      if (bo >= start && bo <= end) {
        R = Math.min(255, R + 45);
        G = Math.min(255, G + 70);
        B = Math.min(255, B + 120);
      }
      ctx.fillStyle = `rgb(${R},${G},${B})`;
      ctx.fillRect(0, py, w, 1);
    }
  }

  function cellClassForOffset(i) {
    const { start, end } = getNormalizedSel();
    let c = 'hex-cell';
    if (i >= start && i <= end) {
      c += ' hex-cell-in-selection';
    }
    if (i === anchorOffset) {
      c += ' hex-cell-caret';
    }
    return c;
  }

  function renderViewport() {
    if (!viewport || !inner || !bytes) return;

    const totalRows = Math.max(1, Math.ceil(bytes.length / BYTES_PER_ROW));
    const scrollTop = viewport.scrollTop;
    const vh = viewport.clientHeight || 400;
    let startRow = Math.floor(scrollTop / rowHeight) - VIEWPORT_BUFFER;
    if (startRow < 0) startRow = 0;
    let endRow = Math.ceil((scrollTop + vh) / rowHeight) + VIEWPORT_BUFFER;
    if (endRow > totalRows) endRow = totalRows;

    inner.style.height = totalRows * rowHeight + 'px';
    inner.innerHTML = '';

    for (let r = startRow; r < endRow; r++) {
      const row = document.createElement('div');
      row.className = 'hex-row';
      row.style.height = rowHeight + 'px';
      row.style.top = r * rowHeight + 'px';

      const off = r * BYTES_PER_ROW;

      const offSpan = document.createElement('span');
      offSpan.className = 'hex-offset';
      offSpan.textContent = padHex(off, 8);
      row.appendChild(offSpan);

      const hexWrap = document.createElement('span');
      hexWrap.className = 'hex-bytes';

      for (let c = 0; c < BYTES_PER_ROW; c++) {
        const i = off + c;
        if (i >= bytes.length) break;

        const cell = document.createElement('span');
        cell.className = cellClassForOffset(i);
        cell.textContent = padHex(bytes[i], 2);
        cell.dataset.offset = String(i);
        cell.title = `Offset ${i} (0x${padHex(i, 8)}) — drag · Shift+click · double-click edit`;

        cell.addEventListener('mousedown', (ev) => {
          beginCellPointer(ev, i);
        });

        cell.addEventListener('dblclick', (ev) => {
          ev.stopPropagation();
          const offset = i;
          const cur = padHex(bytes[offset], 2);
          void (async () => {
            const next = await hexPromptByte(cur);
            if (next === null || next === '') return;
            const v = parseInt(String(next).trim().replace(/^0x/i, ''), 16);
            if (Number.isNaN(v) || v < 0 || v > 255) {
              await hexAlert('Invalid byte. Use 00–FF.');
              return;
            }
            setByteAt(offset, v);
          })();
        });

        hexWrap.appendChild(cell);
        if (c < BYTES_PER_ROW - 1 && i + 1 < bytes.length) {
          hexWrap.appendChild(document.createTextNode(' '));
        }
      }
      row.appendChild(hexWrap);

      const asciiWrap = document.createElement('span');
      asciiWrap.className = 'hex-ascii';

      for (let c = 0; c < BYTES_PER_ROW; c++) {
        const i = off + c;
        if (i >= bytes.length) break;
        const bv = bytes[i];
        const ch = document.createElement('span');
        ch.className = 'hex-ascii-char' + (i >= getNormalizedSel().start && i <= getNormalizedSel().end ? ' hex-ascii-char-sel' : '') + (i === anchorOffset ? ' hex-ascii-char-caret' : '');
        ch.textContent = bv >= 32 && bv < 127 ? String.fromCharCode(bv) : '·';
        ch.dataset.offset = String(i);
        ch.title = `Offset ${i} — drag select`;
        ch.addEventListener('mousedown', (ev) => {
          beginCellPointer(ev, i);
        });
        asciiWrap.appendChild(ch);
      }
      row.appendChild(asciiWrap);

      inner.appendChild(row);
    }
    scheduleMinimap();
  }

  function applySidebarHexFromTextarea() {
    if (!pasteTextarea) return;
    const { ok, u8, error } = decodePasteInput(pasteTextarea.value);
    if (!ok) {
      void hexAlert(error || 'Invalid paste.');
      return;
    }
    if (u8.length === 0) return;
    applyPasteBytes(u8);
  }

  async function applyFromSystemClipboard() {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch (_e) {
      await hexAlert('Clipboard read not available. Paste into the side box instead.');
      return;
    }
    if (pasteTextarea) {
      pasteTextarea.value = text;
    }
    const { ok, u8, error } = decodePasteInput(text);
    if (!ok) {
      await hexAlert(error || 'Invalid clipboard.');
      return;
    }
    if (u8.length === 0) return;
    applyPasteBytes(u8);
  }

  function makeToolbarBtn(text, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-secondary hex-tb-btn';
    b.textContent = text;
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
  }

  function buildHexContextMenu(mount) {
    hexContextMenuEl = document.createElement('div');
    hexContextMenuEl.className = 'hex-context-menu';
    hexContextMenuEl.style.display = 'none';
    hexContextMenuEl.setAttribute('role', 'menu');

    function sep() {
      const d = document.createElement('div');
      d.className = 'hex-ctx-sep';
      return d;
    }

    function item(label, fn) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hex-ctx-item';
      b.textContent = label;
      b.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hideHexContextMenu();
        Promise.resolve(fn()).catch((err) => console.error(err));
      });
      hexContextMenuEl.appendChild(b);
    }

    function expandGroup(title, entries) {
      const wrap = document.createElement('div');
      wrap.className = 'hex-ctx-expand-group';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'hex-ctx-item hex-ctx-expand-head';
      const arrowR = '\u25B6';
      const arrowD = '\u25BC';
      head.textContent = `${title}  ${arrowR}`;
      const body = document.createElement('div');
      body.className = 'hex-ctx-expand-body';
      body.style.display = 'none';
      head.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        head.textContent = `${title}  ${open ? arrowR : arrowD}`;
      });
      for (const ent of entries) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hex-ctx-item hex-ctx-subitem';
        b.textContent = ent.label;
        b.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          hideHexContextMenu();
          Promise.resolve(ent.fn()).catch((err) => console.error(err));
        });
        body.appendChild(b);
      }
      wrap.appendChild(head);
      wrap.appendChild(body);
      hexContextMenuEl.appendChild(wrap);
    }

    expandGroup('Paste from clipboard', [
      { label: 'Replace at selection start', fn: ctxPasteClipboardReplace },
      { label: 'Insert before caret', fn: ctxPasteClipboardInsert }
    ]);
    hexContextMenuEl.appendChild(sep());
    item('Find all occurrences…', ctxFindAllOccurrences);
    item('Replace all occurrences…', ctxReplaceAllOccurrences);
    hexContextMenuEl.appendChild(sep());
    expandGroup('Copy selection as', [
      { label: 'Hex (spaced)', fn: () => copySelectionHex() },
      { label: 'Hex (compact)', fn: ctxCopyHexCompact },
      { label: 'Base64', fn: ctxCopyBase64 },
      { label: 'UTF-8 text', fn: ctxCopyUtf8 },
      { label: 'C array { }', fn: ctxCopyCArray },
      { label: 'Java new byte[]', fn: ctxCopyJavaBytes },
      { label: 'Python bytes.fromhex', fn: ctxCopyPythonFromhex },
      { label: 'Rust &[u8]', fn: ctxCopyRustArray },
      { label: 'UInt32 LE words', fn: ctxCopyHexWordsLE },
      { label: 'Offset & length', fn: ctxCopyOffsetInfo }
    ]);
    hexContextMenuEl.appendChild(sep());
    item('Select all', () => selectAll());
    expandGroup('Fill selection', [
      { label: 'With 0x00', fn: () => fillSelectionWith(0) },
      { label: 'With 0xFF', fn: () => fillSelectionWith(0xff) }
    ]);
    expandGroup('Transform selection', [
      { label: 'Invert (XOR 0xFF)', fn: () => invertSelectionBytes() },
      { label: 'Reverse byte order', fn: () => reverseSelectionBytes() },
      { label: 'Randomize (crypto)', fn: () => randomizeSelection() },
      { label: 'Duplicate at caret (insert)', fn: () => duplicateSelectionAtCaret() }
    ]);
    hexContextMenuEl.appendChild(sep());
    item('Go to offset…', ctxGoToOffset);
    item('Insert N × 0x00 at caret…', ctxInsertZeroBytes);
    hexContextMenuEl.appendChild(sep());
    item('Cut (copy hex + zero)', () => cutSelection());

    mount.appendChild(hexContextMenuEl);
    bindHexCtxDismiss();
  }

  function buildChrome(targetMount) {
    targetMount.innerHTML = '';
    loadPrefs();
    applyFontScale();

    const toolbar = document.createElement('div');
    toolbar.className = 'hex-editor-toolbar';

    const btnText = document.createElement('button');
    btnText.type = 'button';
    btnText.className = 'btn btn-secondary';
    btnText.textContent = '← Text editor';
    btnText.title = 'Close hex view and reload as text';
    btnText.addEventListener('click', () => {
      void (async () => {
        if (computeDirty()) {
          const ok = await hexConfirm('You have unsaved hex changes. Discard and switch to text editor?');
          if (!ok) return;
        }
        close();
        if (typeof reloadTextEditor === 'function') {
          reloadTextEditor();
        }
      })();
    });

    toolbar.appendChild(btnText);
    toolbar.appendChild(makeToolbarBtn('Undo', 'Ctrl+Z', () => undo()));
    toolbar.appendChild(makeToolbarBtn('Redo', 'Ctrl+Y', () => redo()));
    toolbar.appendChild(makeToolbarBtn('A−', 'Smaller font', () => {
      fontPx = Math.max(FONT_MIN, fontPx - 1);
      applyFontScale();
      savePrefs();
      scheduleRender();
      syncMinimapSize();
    }));
    toolbar.appendChild(makeToolbarBtn('A+', 'Larger font', () => {
      fontPx = Math.min(FONT_MAX, fontPx + 1);
      applyFontScale();
      savePrefs();
      scheduleRender();
      syncMinimapSize();
    }));
    fontLabelEl = document.createElement('span');
    fontLabelEl.className = 'hex-font-label';
    fontLabelEl.textContent = fontPx + 'px';
    toolbar.appendChild(fontLabelEl);

    toolbar.appendChild(makeToolbarBtn('Select all', 'Ctrl+A', () => selectAll()));

    hexBodyEl = document.createElement('div');
    hexBodyEl.className = 'hex-editor-body';

    const minimapWrap = document.createElement('div');
    minimapWrap.className = 'hex-minimap-wrap';
    minimapCanvas = document.createElement('canvas');
    minimapCanvas.className = 'hex-minimap';
    minimapCanvas.width = MINIMAP_W;
    minimapCanvas.height = 200;
    minimapCanvas.title = 'Minimap (modified = warm). Click to scroll.';
    minimapCanvas.addEventListener('click', (e) => {
      if (!viewport || !bytes.length) return;
      const rect = minimapCanvas.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      viewport.scrollTop = Math.max(0, Math.min(maxScroll, ratio * viewport.scrollHeight));
      scheduleRender();
    });
    minimapWrap.appendChild(minimapCanvas);

    const viewportWrap = document.createElement('div');
    viewportWrap.className = 'hex-viewport-wrap';

    viewport = document.createElement('div');
    viewport.className = 'hex-viewport';
    viewport.tabIndex = 0;

    inner = document.createElement('div');
    inner.className = 'hex-inner';
    viewport.appendChild(inner);

    viewport.addEventListener('scroll', () => {
      hideHexContextMenu();
      scheduleRender();
      scheduleMinimap();
    });

    viewport.addEventListener('contextmenu', (e) => {
      if (!bytes || bytes.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const o = pickByteOffsetFromPoint(e.clientX, e.clientY);
      if (o !== null) {
        selectionAnchor = anchorOffset = o;
        updateInspector();
        updateSelInfo();
        scheduleRender();
        scheduleMinimap();
      }
      if (!hexContextMenuEl) return;
      hexCtxOpenTs = performance.now();
      hexContextMenuEl.style.display = 'block';
      hexContextMenuEl.style.position = 'fixed';
      hexContextMenuEl.style.zIndex = '100002';
      let x = e.clientX;
      let y = e.clientY;
      const mw = hexContextMenuEl.offsetWidth;
      const mh = hexContextMenuEl.offsetHeight;
      if (x + mw > window.innerWidth - 8) x = Math.max(8, window.innerWidth - mw - 8);
      if (y + mh > window.innerHeight - 8) y = Math.max(8, window.innerHeight - mh - 8);
      hexContextMenuEl.style.left = x + 'px';
      hexContextMenuEl.style.top = y + 'px';
    });

    viewportWrap.appendChild(viewport);

    const resizer = document.createElement('div');
    resizer.className = 'hex-sidebar-resizer';
    resizer.title = 'Drag to resize side panel';
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      resizingSidebar = true;
      const startX = e.clientX;
      const startW = sidebarWidthPx;
      function onMove(ev) {
        if (!resizingSidebar) return;
        const dx = startX - ev.clientX;
        sidebarWidthPx = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + dx));
        if (sidebarEl) {
          sidebarEl.style.width = sidebarWidthPx + 'px';
        }
        savePrefs();
        syncMinimapSize();
      }
      function onUp() {
        resizingSidebar = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    sidebarEl = document.createElement('aside');
    sidebarEl.className = 'hex-sidebar';
    sidebarEl.style.width = sidebarWidthPx + 'px';

    const sideTitle = document.createElement('div');
    sideTitle.className = 'hex-sidebar-title';
    sideTitle.textContent = 'Data inspector';
    sidebarEl.appendChild(sideTitle);

    inspectorEl = document.createElement('div');
    inspectorEl.className = 'hex-data-inspector hex-sidebar-inspector';
    inspectorEl.innerHTML = '<span class="hex-insp-muted">Select a byte</span>';
    sidebarEl.appendChild(inspectorEl);

    selInfoEl = document.createElement('div');
    selInfoEl.className = 'hex-sel-info';
    selInfoEl.textContent = '';
    sidebarEl.appendChild(selInfoEl);

    const modeLabel = document.createElement('div');
    modeLabel.className = 'hex-sidebar-title';
    modeLabel.textContent = 'Paste mode';
    sidebarEl.appendChild(modeLabel);

    const modeRow = document.createElement('div');
    modeRow.className = 'hex-paste-modes';
    pasteOptEls.replace = makeToolbarBtn('Replace', 'Overwrite bytes from selection start (grow if needed)', () => {
      pasteModeReplace = true;
      savePrefs();
      syncPasteChrome();
    });
    pasteOptEls.insert = makeToolbarBtn('Insert', 'Insert bytes before caret; shifts rest right', () => {
      pasteModeReplace = false;
      savePrefs();
      syncPasteChrome();
    });
    modeRow.appendChild(pasteOptEls.replace);
    modeRow.appendChild(pasteOptEls.insert);
    sidebarEl.appendChild(modeRow);

    const fmtLabel = document.createElement('div');
    fmtLabel.className = 'hex-sidebar-title';
    fmtLabel.textContent = 'Paste as';
    sidebarEl.appendChild(fmtLabel);

    const fmtRow = document.createElement('div');
    fmtRow.className = 'hex-paste-modes';
    pasteOptEls.hex = makeToolbarBtn('Hex', 'Pairs: DE AD or deadbeef', () => {
      pasteFormatHex = true;
      savePrefs();
      syncPasteChrome();
    });
    pasteOptEls.utf8 = makeToolbarBtn('UTF-8 text', 'Any string → UTF-8 bytes', () => {
      pasteFormatHex = false;
      savePrefs();
      syncPasteChrome();
    });
    fmtRow.appendChild(pasteOptEls.hex);
    fmtRow.appendChild(pasteOptEls.utf8);
    sidebarEl.appendChild(fmtRow);

    const pasteTitle = document.createElement('div');
    pasteTitle.className = 'hex-sidebar-title';
    pasteTitle.textContent = 'Buffer';
    sidebarEl.appendChild(pasteTitle);

    pasteTextarea = document.createElement('textarea');
    pasteTextarea.className = 'hex-paste-area';
    pasteTextarea.spellcheck = false;
    sidebarEl.appendChild(pasteTextarea);

    syncPasteChrome();

    const pasteRow = document.createElement('div');
    pasteRow.className = 'hex-paste-actions';
    const btnApply = makeToolbarBtn('Apply', 'Decode buffer with Hex/UTF-8 and apply Replace/Insert', () =>
      applySidebarHexFromTextarea()
    );
    const btnClip = makeToolbarBtn('Clipboard → apply', 'Paste from OS clipboard with current options', () =>
      void applyFromSystemClipboard()
    );
    pasteRow.appendChild(btnApply);
    pasteRow.appendChild(btnClip);
    sidebarEl.appendChild(pasteRow);

    hexBodyEl.appendChild(minimapWrap);
    hexBodyEl.appendChild(viewportWrap);
    hexBodyEl.appendChild(resizer);
    hexBodyEl.appendChild(sidebarEl);

    targetMount.appendChild(toolbar);
    targetMount.appendChild(hexBodyEl);

    buildHexContextMenu(targetMount);

    bindHexDocDragListenersOnce();

    viewport.addEventListener('keydown', (e) => {
      if (!bytes || bytes.length === 0) return;
      const shift = e.shiftKey;
      const step = e.ctrlKey || e.metaKey ? BYTES_PER_ROW * 8 : 1;
      const rowStep = BYTES_PER_ROW;

      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        const saveFile = window.__previewSaveFile;
        if (typeof saveFile === 'function') saveFile();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        void copySelectionHex();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        void cutSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        void (async () => {
          let text = '';
          try {
            text = await navigator.clipboard.readText();
          } catch (_e) {
            await hexAlert('Paste: use the side panel or put text on the clipboard first.');
            return;
          }
          const { ok, u8, error } = decodePasteInput(text);
          if (!ok) {
            await hexAlert(error || 'Invalid clipboard for current paste mode.');
            return;
          }
          if (u8.length === 0) return;
          applyPasteBytes(u8);
        })();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const n = Math.max(0, anchorOffset - (e.ctrlKey || e.metaKey ? rowStep : step));
        setCaret(n, shift);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const n = Math.min(bytes.length - 1, anchorOffset + (e.ctrlKey || e.metaKey ? rowStep : step));
        setCaret(n, shift);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const n = Math.max(0, anchorOffset - rowStep);
        setCaret(n, shift);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const n = Math.min(bytes.length - 1, anchorOffset + rowStep);
        setCaret(n, shift);
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        const row = Math.floor(anchorOffset / BYTES_PER_ROW);
        setCaret(row * BYTES_PER_ROW, shift);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        const row = Math.floor(anchorOffset / BYTES_PER_ROW);
        const end = Math.min(bytes.length - 1, (row + 1) * BYTES_PER_ROW - 1);
        setCaret(end, shift);
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        deleteSelectionOrByte(true);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectionOrByte(false);
        return;
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => syncMinimapSize()).observe(viewportWrap);
    }
  }

  /**
   * @param {string} path
   * @param {{ monacoHost: HTMLElement, mount: HTMLElement, onDirty?: (boolean)=>void, reloadTextEditor?: ()=>void }} opts
   */
  async function open(path, opts) {
    if (!opts || !opts.mount || !opts.monacoHost) {
      console.error('PreviewHexEditor.open: missing mount or monacoHost');
      return false;
    }

    if (active && computeDirty()) {
      const ok = await hexConfirm('Hex editor has unsaved changes. Continue and discard them?');
      if (!ok) {
        return false;
      }
    }

    close();

    const res = await fetch('/__api__/files?path=' + encodeURIComponent(path) + '&binary=true');
    const data = await res.json();
    if (!data.success || !data.content) {
      await hexAlert('Could not load file for hex view: ' + (data.error || 'Unknown error'));
      return false;
    }

    currentPath = path;
    bytes = base64ToBytes(data.content);
    originalBytes = new Uint8Array(bytes);
    mountEl = opts.mount;
    monacoHostEl = opts.monacoHost;
    dirtyCallback = opts.onDirty || null;
    reloadTextEditor = opts.reloadTextEditor || null;

    undoStack.length = 0;
    redoStack.length = 0;

    buildChrome(mountEl);
    selectionAnchor = 0;
    anchorOffset = 0;
    monacoHostEl.style.display = 'none';
    mountEl.style.display = 'flex';
    active = true;

    updateInspector();
    updateSelInfo();
    requestAnimationFrame(() => {
      renderViewport();
      syncMinimapSize();
      if (viewport) {
        viewport.focus();
      }
    });

    notifyDirty();
    return true;
  }

  function close() {
    if (!active) return;
    active = false;
    dragActive = false;
    pasteOptEls = { replace: null, insert: null, hex: null, utf8: null };
    hideHexContextMenu();
    hexContextMenuEl = null;
    if (monacoHostEl) {
      monacoHostEl.style.display = '';
    }
    if (mountEl) {
      mountEl.style.display = 'none';
      mountEl.innerHTML = '';
    }
    bytes = null;
    originalBytes = null;
    currentPath = '';
    viewport = null;
    inner = null;
    inspectorEl = null;
    minimapCanvas = null;
    hexBodyEl = null;
    sidebarEl = null;
    pasteTextarea = null;
    selInfoEl = null;
    fontLabelEl = null;
    dirtyCallback = null;
    reloadTextEditor = null;
    undoStack.length = 0;
    redoStack.length = 0;
  }

  async function save(getFilePath, statusEl) {
    if (!active || !bytes || !currentPath) {
      return { success: false };
    }

    const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
    if (filePath !== currentPath) {
      console.warn('Hex save path mismatch');
    }

    const b64 = bytesToBase64(bytes);

    if (statusEl) {
      statusEl.textContent = 'Saving…';
      statusEl.className = 'status saving';
    }

    try {
      const res = await fetch('/__api__/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentPath,
          content: b64,
          isBinary: true
        })
      });
      const data = await res.json();
      if (!data.success) {
        if (statusEl) {
          statusEl.textContent = 'Error: ' + data.error;
          statusEl.className = 'status error';
        }
        await hexAlert('Save failed: ' + (data.error || 'Unknown'));
        return { success: false };
      }

      originalBytes = new Uint8Array(bytes);
      notifyDirty();

      if (statusEl) {
        statusEl.textContent = 'Saved';
        statusEl.className = 'status saved';
      }
      return { success: true, originalBase64: b64 };
    } catch (e) {
      console.error(e);
      if (statusEl) {
        statusEl.textContent = 'Save error';
        statusEl.className = 'status error';
      }
      await hexAlert('Save error: ' + (e.message || e));
      return { success: false };
    }
  }

  return {
    open,
    close,
    save,
    isActive,
    isDirty,
    getPath: () => currentPath,
    scheduleRender
  };
})();
