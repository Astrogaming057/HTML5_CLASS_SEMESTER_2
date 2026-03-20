/**
 * Cross-file module resolution for Go to Definition and import-aware completions.
 * Resolves relative specifiers (./ ../) against workspace paths via /__api__/files.
 */
window.PreviewCrossModuleNavigation = (function() {
  const contentCache = new Map();
  const exportCache = new Map();

  const EXT_TRIES = ['', '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs'];
  const INDEX_TRIES = ['.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs'].map((e) => '/index' + e);

  function normalizeWsPath(p) {
    return String(p || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/');
  }

  function modelPathFromUri(model) {
    if (!model || !model.uri) return '';
    return normalizeWsPath(model.uri.path || '');
  }

  function resolveRelativeSpecifier(fromFile, specifier) {
    const raw = String(specifier || '').trim().replace(/^['"]|['"]$/g, '');
    if (!raw || /^https?:\/\//i.test(raw)) return null;
    if (!raw.startsWith('.') && !raw.startsWith('/')) return null;

    let base = normalizeWsPath(fromFile).split('/');
    base.pop();

    let rel = raw;
    if (raw.startsWith('/')) {
      base = [];
      rel = raw.slice(1);
    }

    const parts = rel.split('/');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '' || part === '.') continue;
      if (part === '..') {
        if (base.length) base.pop();
      } else {
        base.push(part);
      }
    }
    return base.join('/');
  }

  async function fileExists(path) {
    const q = normalizeWsPath(path);
    try {
      const r = await fetch('/__api__/files?path=' + encodeURIComponent(q));
      const d = await r.json();
      return !!(d && d.success);
    } catch (_) {
      return false;
    }
  }

  async function fetchText(path) {
    const q = normalizeWsPath(path);
    if (contentCache.has(q)) return /** @type {string} */ (contentCache.get(q));
    let text = null;
    try {
      const cacheR = await fetch('/__api__/files/editor?path=' + encodeURIComponent(q));
      const cacheD = await cacheR.json();
      if (cacheD && cacheD.success && cacheD.exists && typeof cacheD.content === 'string') {
        text = cacheD.content;
      }
      if (text == null) {
        const r = await fetch('/__api__/files?path=' + encodeURIComponent(q));
        const d = await r.json();
        if (d && d.success && typeof d.content === 'string') text = d.content;
      }
      if (text != null) contentCache.set(q, text);
    } catch (e) {
      console.warn('[crossModule] fetchText', e);
    }
    return text;
  }

  function candidatePaths(baseNoExt) {
    const list = [];
    const seen = new Set();
    const add = (p) => {
      const n = normalizeWsPath(p);
      if (!seen.has(n)) {
        seen.add(n);
        list.push(n);
      }
    };
    add(baseNoExt);
    EXT_TRIES.forEach((e) => {
      if (e) add(baseNoExt + e);
    });
    const tail = baseNoExt.split('/').pop() || '';
    const hasExt = /\.\w+$/.test(tail);
    if (!hasExt) {
      INDEX_TRIES.forEach((ix) => add(baseNoExt + ix));
    }
    return list;
  }

  async function resolveModulePath(fromFile, specifier) {
    const base = resolveRelativeSpecifier(fromFile, specifier);
    if (!base) return null;
    const candidates = candidatePaths(base);
    for (const c of candidates) {
      if (await fileExists(c)) {
        const t = await fetchText(c);
        if (t != null) return normalizeWsPath(c);
      }
    }
    return null;
  }

  function specifierAtCursor(model, position) {
    const line = model.getLineContent(position.lineNumber);
    const col = position.column;
    const res = [
      /\bfrom\s+(['"])((?:\.\.?\/|\.\/)[^'"]*)\1/g,
      /\bimport\s+(['"])((?:\.\.?\/|\.\/)[^'"]*)\1/g,
      /require\s*\(\s*(['"])((?:\.\.?\/|\.\/)[^'"]*)\1\s*\)/g,
    ];
    for (let r = 0; r < res.length; r++) {
      const re = res[r];
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        const pathPart = m[2];
        const outerStart = m.index;
        const pathStartInLine = line.indexOf(pathPart, outerStart);
        const pathEndInLine = pathStartInLine + pathPart.length;
        const startCol = pathStartInLine + 1;
        const endCol = pathEndInLine + 1;
        if (col >= startCol && col <= endCol) return pathPart;
      }
    }
    return null;
  }

  function splitImportClause(clause) {
    const parts = clause.split(',');
    const out = [];
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      const mm = p.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      if (mm) out.push({ remote: mm[1], local: mm[2] || mm[1] });
    }
    return out;
  }

  function findImportBindingForSymbol(content, symbol) {
    const reMix =
      /import\s+(\w+)\s*,\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = reMix.exec(content)) !== null) {
      if (m[1] === symbol) {
        return { kind: 'default', specifier: m[3], remote: null, local: symbol };
      }
      const names = splitImportClause(m[2]);
      for (const n of names) {
        if (n.local === symbol) {
          return { kind: 'named', specifier: m[3], remote: n.remote, local: symbol };
        }
      }
    }

    const reDefault = /import(?:\s+type)?\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
    while ((m = reDefault.exec(content)) !== null) {
      if (m[1] === symbol) {
        return { kind: 'default', specifier: m[2], remote: null, local: symbol };
      }
    }

    const reNs = /import\s*\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
    while ((m = reNs.exec(content)) !== null) {
      if (m[1] === symbol) {
        return { kind: 'namespace', specifier: m[2], remote: null, local: symbol };
      }
    }

    const reNamed = /import(?:\s+type)?\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
    while ((m = reNamed.exec(content)) !== null) {
      const names = splitImportClause(m[1]);
      for (const n of names) {
        if (n.local === symbol) {
          return { kind: 'named', specifier: m[2], remote: n.remote, local: symbol };
        }
      }
    }

    const reReqDef = /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = reReqDef.exec(content)) !== null) {
      if (m[1] === symbol) {
        return { kind: 'requireDefault', specifier: m[2], remote: null, local: symbol };
      }
    }

    const reReqNamed =
      /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = reReqNamed.exec(content)) !== null) {
      const names = splitImportClause(m[1]);
      for (const n of names) {
        if (n.local === symbol) {
          return { kind: 'named', specifier: m[2], remote: n.remote, local: symbol };
        }
      }
    }

    return null;
  }

  function findDefinitionColumn(line, token) {
    const i = line.indexOf(token);
    return i >= 0 ? i + 1 : 1;
  }

  function findDefaultExportDefinition(content) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let mm = line.match(/export\s+default\s+(?:async\s+)?function\s+(\w+)/);
      if (mm) return { line: i + 1, column: findDefinitionColumn(line, mm[1]) };
      mm = line.match(/export\s+default\s+(?:async\s+)?function\s*\(/);
      if (mm) return { line: i + 1, column: line.indexOf('function') + 1 };
      mm = line.match(/export\s+default\s+class\s+(\w+)/);
      if (mm) return { line: i + 1, column: findDefinitionColumn(line, mm[1]) };
      mm = line.match(/export\s+default\s+([\w$]+)/);
      if (mm && mm[1] !== 'function' && mm[1] !== 'class' && mm[1] !== 'async') {
        return { line: i + 1, column: findDefinitionColumn(line, mm[1]) };
      }
    }
    return null;
  }

  function findExportedNameDefinition(content, remoteName) {
    const lines = content.split('\n');
    const sym = remoteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linePatterns = [
      new RegExp(`\\bexport\\s+(?:default\\s+)?(?:async\\s+)?function\\s+${sym}\\b`),
      new RegExp(`\\bexport\\s+(?:async\\s+)?(?:const|let|var|class)\\s+${sym}\\b`),
      new RegExp(`\\b(?:function|class|const|let|var)\\s+${sym}\\b`),
      new RegExp(`\\bexports\\.${sym}\\s*=`),
      new RegExp(`\\bmodule\\.exports\\.${sym}\\s*=`),
    ];
    for (let i = 0; i < lines.length; i++) {
      for (let p = 0; p < linePatterns.length; p++) {
        if (linePatterns[p].test(lines[i])) {
          return { line: i + 1, column: findDefinitionColumn(lines[i], remoteName) };
        }
      }
    }
    return null;
  }

  function findAnyDefinition(content, symbol) {
    const lines = content.split('\n');
    const sym = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`\\bexport\\s+(?:default\\s+)?(?:async\\s+)?function\\s+${sym}\\b`),
      new RegExp(`\\bexport\\s+(?:async\\s+)?(?:const|let|var|class)\\s+${sym}\\b`),
      new RegExp(`\\b(function|class|const|let|var)\\s+${sym}\\b`),
    ];
    for (let i = 0; i < lines.length; i++) {
      for (let p = 0; p < patterns.length; p++) {
        const match = lines[i].match(patterns[p]);
        if (match) {
          const col = findDefinitionColumn(lines[i], symbol);
          return { line: i + 1, column: col };
        }
      }
    }
    return null;
  }

  /** First `module.exports = Identifier` assignment (CommonJS default export). */
  function findCommonJsDefaultExportBinding(content) {
    if (!content) return null;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const mm = lines[i].match(/^\s*module\.exports\s*=\s*([\w$]+)\b/);
      if (mm) return mm[1];
    }
    return null;
  }

  /**
   * Resolve where the definition starts in a module for hover/go-to (line 1-based).
   */
  function findDefinitionLocationInModule(modContent, binding, sym) {
    if (!modContent || !binding) return null;
    if (binding.kind === 'named' && binding.remote) {
      return findExportedNameDefinition(modContent, binding.remote);
    }
    if (binding.kind === 'namespace') {
      return { line: 1, column: 1 };
    }
    if (binding.kind === 'default' || binding.kind === 'requireDefault') {
      let loc = findDefaultExportDefinition(modContent);
      if (loc) return loc;
      const cjsName = findCommonJsDefaultExportBinding(modContent);
      if (cjsName) {
        loc = findAnyDefinition(modContent, cjsName);
        if (loc) return loc;
      }
      return findAnyDefinition(modContent, sym);
    }
    return null;
  }

  /**
   * Extract a balanced { } block starting near startLine, or up to maxLines slice.
   */
  function extractDefinitionSnippet(content, startLine1Based, maxLines) {
    const cap = Math.min(Math.max(maxLines || 45, 15), 120);
    const lines = content.split('\n');
    const i0 = startLine1Based - 1;
    if (i0 < 0 || i0 >= lines.length) return '';

    let brace = 0;
    let found = false;
    const acc = [];
    for (let i = i0; i < lines.length && acc.length < cap; i++) {
      const line = lines[i];
      acc.push(line);
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '{') {
          brace++;
          found = true;
        } else if (ch === '}') {
          brace--;
        }
      }
      if (found && brace <= 0 && acc.length > 0) break;
    }
    if (!found) {
      return lines.slice(i0, Math.min(lines.length, i0 + Math.min(cap, 40))).join('\n');
    }
    return acc.join('\n');
  }

  function fenceLangForMonacoLang(monacoLang) {
    if (!monacoLang) return 'javascript';
    if (monacoLang === 'typescript' || monacoLang === 'typescriptreact') return 'typescript';
    return 'javascript';
  }

  async function buildCrossModuleHover(model, position, getFilePath) {
    let fromPath = normalizeWsPath(typeof getFilePath === 'function' ? getFilePath() : '');
    if (!fromPath) fromPath = modelPathFromUri(model);
    if (!fromPath) return null;

    const word = model.getWordAtPosition(position);
    if (!word || !word.word) return null;
    const sym = word.word;
    const content = model.getValue();
    const monacoLang = model.getLanguageId();

    if (findAnyDefinition(content, sym)) return null;

    const binding = findImportBindingForSymbol(content, sym);
    if (binding) {
      const resolved = await resolveModulePath(fromPath, binding.specifier);
      if (!resolved) return null;
      const modContent = await fetchText(resolved);
      if (!modContent) return null;
      const loc = findDefinitionLocationInModule(modContent, binding, sym);
      if (!loc) return null;
      const snippet = extractDefinitionSnippet(modContent, loc.line, 50);
      if (!snippet) return null;
      const fence = fenceLangForMonacoLang(monacoLang);
      let kind = 'import';
      if (binding.kind === 'requireDefault') kind = 'require';
      else if (binding.kind === 'namespace') kind = 'namespace import';

      const header = `**${sym}** _(${kind})_ · \`${resolved}\``;
      const md = `${header}\n\n\`\`\`${fence}\n${snippet}\n\`\`\``;
      return {
        range: new monaco.Range(
          word.startLineNumber,
          word.startColumn,
          word.endLineNumber,
          word.endColumn,
        ),
        contents: [{ value: md, isTrusted: true }],
      };
    }

    for (const om of monaco.editor.getModels()) {
      const mp = modelPathFromUri(om);
      if (!mp || mp === fromPath) continue;
      const other = om.getValue();
      const d = findAnyDefinition(other, sym);
      if (d) {
        const snippet = extractDefinitionSnippet(other, d.line, 50);
        if (!snippet) return null;
        const fence = fenceLangForMonacoLang(monacoLang);
        const md = `**${sym}** _(open model)_ · \`${mp}\`\n\n\`\`\`${fence}\n${snippet}\n\`\`\``;
        return {
          range: new monaco.Range(
            word.startLineNumber,
            word.startColumn,
            word.endLineNumber,
            word.endColumn,
          ),
          contents: [{ value: md, isTrusted: true }],
        };
      }
    }

    return null;
  }

  function getExportList(content, pathKey) {
    if (exportCache.has(pathKey)) return /** @type {{ names: string[], hasDefault: boolean }} */ (exportCache.get(pathKey));
    const names = new Set();
    let hasDefault = false;
    let m;
    const rExportDefault = /export\s+default\b/g;
    while ((m = rExportDefault.exec(content)) !== null) hasDefault = true;

    const rFn = /export\s+(?:async\s+)?function\s+(\w+)/g;
    while ((m = rFn.exec(content)) !== null) names.add(m[1]);

    const rDecl = /export\s+(?:async\s+)?(?:const|let|var|class)\s+(\w+)/g;
    while ((m = rDecl.exec(content)) !== null) names.add(m[1]);

    const rBlock = /export\s*\{([^}]+)\}/g;
    while ((m = rBlock.exec(content)) !== null) {
      splitImportClause(m[1]).forEach((n) => names.add(n.remote));
    }

    const rEx = /exports\.(\w+)\s*=/g;
    while ((m = rEx.exec(content)) !== null) names.add(m[1]);

    const rMod = /module\.exports\.(\w+)\s*=/g;
    while ((m = rMod.exec(content)) !== null) names.add(m[1]);

    const out = { names: [...names].sort(), hasDefault };
    exportCache.set(pathKey, out);
    return out;
  }

  async function waitForModel(editor, targetPath) {
    const want = normalizeWsPath(targetPath);
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const edModel = editor.getModel();
      const p = edModel && normalizeWsPath(edModel.uri.path);
      if (p === want) return edModel;
      await new Promise((r) => setTimeout(r, 35));
    }
    return editor.getModel();
  }

  function reveal(editor, line, column) {
    try {
      editor.setPosition({ lineNumber: line, column: Math.max(1, column) });
      editor.revealLineInCenter(line);
    } catch (e) {
      console.warn('[crossModule] reveal', e);
    }
  }

  async function tryCrossFileJump(editor, getFilePath, switchToFile) {
    if (typeof switchToFile !== 'function') return false;

    const position = editor.getPosition();
    if (!position) return false;
    const model = editor.getModel();
    if (!model) return false;

    // Prefer app file path: after tab switches the model URI can lag until setModel runs;
    // filePathRef is always updated for the active tab.
    let fromPath = normalizeWsPath(typeof getFilePath === 'function' ? getFilePath() : '');
    if (!fromPath) {
      fromPath = modelPathFromUri(model);
    }
    if (!fromPath) return false;

    const content = model.getValue();

    const strSpec = specifierAtCursor(model, position);
    if (strSpec) {
      const resolved = await resolveModulePath(fromPath, strSpec);
      if (resolved) {
        await switchToFile(resolved);
        await waitForModel(editor, resolved);
        reveal(editor, 1, 1);
        return true;
      }
    }

    const word = model.getWordAtPosition(position);
    if (!word || !word.word) return false;
    const sym = word.word;

    const binding = findImportBindingForSymbol(content, sym);
    if (binding) {
      const resolved = await resolveModulePath(fromPath, binding.specifier);
      if (resolved) {
        const modContent = await fetchText(resolved);
        let line = 1;
        let col = 1;
        if (modContent) {
          const d = findDefinitionLocationInModule(modContent, binding, sym);
          if (d) {
            line = d.line;
            col = d.column;
          }
        }
        await switchToFile(resolved);
        await waitForModel(editor, resolved);
        reveal(editor, line, col);
        return true;
      }
    }

    if (findAnyDefinition(content, sym)) {
      return false;
    }

    for (const om of monaco.editor.getModels()) {
      const mp = modelPathFromUri(om);
      if (!mp || mp === normalizeWsPath(fromPath)) continue;
      const d = findAnyDefinition(om.getValue(), sym);
      if (d) {
        await switchToFile(mp);
        await waitForModel(editor, mp);
        reveal(editor, d.line, d.column);
        return true;
      }
    }

    return false;
  }

  let completionRegistered = false;
  let hoverRegistered = false;

  function initDefinitionHoverProviders(getFilePath) {
    if (hoverRegistered || typeof monaco === 'undefined') return;
    hoverRegistered = true;

    const getter =
      typeof getFilePath === 'function'
        ? getFilePath
        : () =>
            (typeof window.__previewFilePath === 'function' ? window.__previewFilePath() : '');

    const langs = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
    langs.forEach((lang) => {
      monaco.languages.registerHoverProvider(lang, {
        provideHover: async (model, position) => {
          try {
            return await buildCrossModuleHover(model, position, getter);
          } catch (e) {
            console.warn('[crossModule] hover', e);
            return null;
          }
        },
      });
    });
  }

  function initCompletionProviders() {
    if (completionRegistered || typeof monaco === 'undefined') return;
    completionRegistered = true;

    const langs = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
    langs.forEach((lang) => {
      monaco.languages.registerCompletionItemProvider(lang, {
        triggerCharacters: ['{', ','],
        provideCompletionItems: async (model, position) => {
          try {
            const line = model.getLineContent(position.lineNumber);
            const before = line.substring(0, position.column - 1);
            const inImportBrace = /\bimport\s*\{[^}]*$/.test(before);
            if (!inImportBrace) {
              return { suggestions: [] };
            }
            const sameLine = line.match(/import(?:\s+type)?\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/);
            if (!sameLine) return { suggestions: [] };

            const specifier = sameLine[2];
            let fromPath = normalizeWsPath(
              typeof window.__previewFilePath === 'function' ? window.__previewFilePath() : '',
            );
            if (!fromPath) fromPath = modelPathFromUri(model);
            const resolved = await resolveModulePath(fromPath, specifier);
            if (!resolved) return { suggestions: [] };
            const mod = await fetchText(resolved);
            if (!mod) return { suggestions: [] };
            const exp = getExportList(mod, resolved);
            const suggestions = exp.names.map((name) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: name,
              detail: specifier,
            }));
            return { suggestions };
          } catch (_) {
            return { suggestions: [] };
          }
        },
      });
    });
  }

  function invalidateCachesForPath(path) {
    const n = normalizeWsPath(path);
    contentCache.delete(n);
    exportCache.delete(n);
  }

  return {
    tryCrossFileJump,
    initCompletionProviders,
    initDefinitionHoverProviders,
    buildCrossModuleHover,
    resolveModulePath,
    invalidateCachesForPath,
    normalizeWsPath,
  };
})();
