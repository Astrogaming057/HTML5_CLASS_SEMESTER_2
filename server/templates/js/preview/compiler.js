window.PreviewCompiler = (function () {
  function $(id) {
    return document.getElementById(id);
  }

  // Judge0 language ids (community edition) - keep this small and practical
  // You can add more mappings later.
  const LANGUAGE_MAP = {
    javascript: 63, // JavaScript (Node.js 12+)
    typescript: 74, // TypeScript
    python: 71, // Python
    java: 62, // Java
    c: 50, // C
    cpp: 76, // C++
    'c++': 76,
    csharp: 51, // C#
    kotlin: 78, // Kotlin
    rust: 73, // Rust
    go: 60, // Go
    php: 68, // PHP
    lua: 64 // Lua
  };

  function monacoLangToJudge0Id(monacoLanguage) {
    if (!monacoLanguage || typeof monacoLanguage !== 'string') return null;
    const key = monacoLanguage.toLowerCase();

    if (key === 'javascript') return LANGUAGE_MAP.javascript;
    if (key === 'typescript') return LANGUAGE_MAP.typescript;
    if (key === 'python') return LANGUAGE_MAP.python;
    if (key === 'java') return LANGUAGE_MAP.java;
    if (key === 'c') return LANGUAGE_MAP.c;
    if (key === 'cpp') return LANGUAGE_MAP.cpp;
    if (key === 'csharp') return LANGUAGE_MAP.csharp;
    if (key === 'kotlin') return LANGUAGE_MAP.kotlin;
    if (key === 'rust') return LANGUAGE_MAP.rust;
    if (key === 'go') return LANGUAGE_MAP.go;
    if (key === 'php') return LANGUAGE_MAP.php;
    if (key === 'lua') return LANGUAGE_MAP.lua;

    return null;
  }

  function getActiveEditor() {
    return window.__previewEditor || null;
  }

  function getActiveFilePath() {
    try {
      return typeof window.__previewFilePath === 'function' ? window.__previewFilePath() : null;
    } catch {
      return null;
    }
  }

  function cleanAnsi(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\\u001b\[[0-9;]*m/g, '');
  }

  function addOutputLine(text, type) {
    const out = $('compilerOutput');
    if (!out) return;

    const clean = cleanAnsi(text || '');
    if (!clean.trim()) return;

    const line = document.createElement('div');
    line.className = `compiler-line ${type || 'log'}`;
    line.textContent = clean;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
  }

  function clearOutput() {
    const out = $('compilerOutput');
    if (out) out.textContent = '';
  }

  function setBusy(isBusy) {
    const btn = $('compilerRunBtn');
    if (!btn) return;
    btn.disabled = !!isBusy;
    btn.textContent = isBusy ? 'Running…' : '▶ Run';
  }

  // State for long-running local-node runs
  const localRunState = {
    runId: null,
    cursor: 0,
    pollTimer: null
  };

  function pickLanguageFromFile() {
    const editor = getActiveEditor();
    const select = $('compilerLanguage');
    if (!select) return false;

    const model = editor && editor.getModel ? editor.getModel() : null;
    let monacoLang = model && model.getLanguageId ? model.getLanguageId() : null;
    let judge0Id = monacoLangToJudge0Id(monacoLang);

    // Fallback: infer from file extension if Monaco language is unknown
    if (!judge0Id) {
      const filePath = getActiveFilePath() || '';
      const lower = filePath.toLowerCase();
      if (lower.endsWith('.js') || lower.endsWith('.cjs') || lower.endsWith('.mjs')) {
        monacoLang = monacoLang || 'javascript';
        judge0Id = LANGUAGE_MAP.javascript;
      } else if (lower.endsWith('.ts')) {
        monacoLang = monacoLang || 'typescript';
        judge0Id = LANGUAGE_MAP.typescript;
      } else if (lower.endsWith('.py')) {
        monacoLang = monacoLang || 'python';
        judge0Id = LANGUAGE_MAP.python;
      } else if (lower.endsWith('.java')) {
        monacoLang = monacoLang || 'java';
        judge0Id = LANGUAGE_MAP.java;
      } else if (lower.endsWith('.c')) {
        monacoLang = monacoLang || 'c';
        judge0Id = LANGUAGE_MAP.c;
      } else if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) {
        monacoLang = monacoLang || 'cpp';
        judge0Id = LANGUAGE_MAP.cpp;
      }
    }

    if (judge0Id) {
      select.value = String(judge0Id);
      addOutputLine(`Using file language: ${monacoLang}`, 'info');
      return true;
    }

    const filePath = getActiveFilePath();
    addOutputLine(`Couldn't detect a runnable language for this file${filePath ? ` (${filePath})` : ''}. Pick one manually.`, 'warn');
    return false;
  }

  async function run() {
    const editor = getActiveEditor();
    const select = $('compilerLanguage');
    const runtimeSel = $('compilerRuntime');
    const stdinEl = $('compilerStdin');

    if (!editor || !editor.getValue) {
      clearOutput();
      addOutputLine('No active editor found.', 'error');
      return;
    }
    if (!select) return;

    const source = editor.getValue();
    try {
      localStorage.setItem('lastCompilerSource', source);
    } catch {}
    const runtime = runtimeSel && runtimeSel.value ? runtimeSel.value : 'sandbox';
    const filePath = getActiveFilePath();

    // Best-effort: choose module type for local-node
    let moduleType = 'cjs';
    if (filePath && typeof filePath === 'string') {
      const lower = filePath.toLowerCase();
      if (lower.endsWith('.mjs')) moduleType = 'esm';
      if (lower.endsWith('.cjs')) moduleType = 'cjs';
    }
    if (moduleType !== 'esm') {
      // Heuristic: if user is using ESM syntax, run as esm
      if (/\bimport\s+.*from\s+['"][^'"]+['"]\s*;?/m.test(source) || /\bexport\s+(default\s+)?/m.test(source)) {
        moduleType = 'esm';
      }
    }
    try {
      localStorage.setItem('lastCompilerRuntime', runtime);
      localStorage.setItem('lastCompilerModuleType', moduleType);
      if (filePath) localStorage.setItem('lastCompilerFilePath', filePath);
    } catch {}
    const languageId = Number(select.value);
    const stdin = stdinEl && typeof stdinEl.value === 'string' ? stdinEl.value : '';

    if (runtime === 'local-node') {
      return startOrToggleLocalRun({ source, stdin, moduleType, filePath });
    }

    // Sandbox (Judge0) one-shot run
    clearOutput();
    addOutputLine(`Running… (languageId=${languageId})`, 'info');
    setBusy(true);

    try {
      const resp = await fetch('/__api__/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languageId, source, stdin })
      });
      const data = await resp.json().catch(() => null);

      if (!data || !data.success) {
        addOutputLine(data && data.error ? data.error : 'Run failed.', 'error');
        return;
      }

      const r = data.result || {};
      const statusDesc = r.status && r.status.description ? r.status.description : 'Unknown';
      const runner = r.runner ? ` | runner=${r.runner}` : '';
      addOutputLine(`Status: ${statusDesc}${runner}${r.time ? ` | time=${r.time}s` : ''}${r.memory ? ` | memory=${r.memory}KB` : ''}`, 'info');

      if (r.compile_output) {
        addOutputLine('--- compile_output ---', 'warn');
        r.compile_output.split('\n').forEach(line => addOutputLine(line, 'warn'));
      }

      if (r.stderr) {
        addOutputLine('--- stderr ---', 'error');
        r.stderr.split('\n').forEach(line => addOutputLine(line, 'error'));
      }

      if (r.stdout) {
        addOutputLine('--- stdout ---', 'log');
        r.stdout.split('\n').forEach(line => addOutputLine(line, 'log'));
      }

      if (!r.stdout && !r.stderr && !r.compile_output) {
        addOutputLine('(no output)', 'log');
      }
    } catch (e) {
      addOutputLine(e && e.message ? e.message : 'Run failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function startOrToggleLocalRun({ source, stdin, moduleType, filePath }) {
    const btn = $('compilerRunBtn');

    // If a run is active, treat as Kill
    if (localRunState.runId) {
      try {
        await fetch('/__api__/run/node/kill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId: localRunState.runId })
        });
      } catch {}
      if (localRunState.pollTimer) {
        clearInterval(localRunState.pollTimer);
      }
      localRunState.runId = null;
      localRunState.cursor = 0;
      localRunState.pollTimer = null;
      if (btn) btn.textContent = '▶ Run';
      addOutputLine('[killed current run]', 'warn');
      return;
    }

    clearOutput();
    addOutputLine('Starting local Node process (streaming logs)...', 'info');
    if (btn) btn.textContent = 'Kill';

    try {
      const resp = await fetch('/__api__/run/node/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, stdin, moduleType, filePath })
      });
      const data = await resp.json().catch(() => null);
      if (!data || !data.success || !data.runId) {
        addOutputLine(data && data.error ? data.error : 'Failed to start local run.', 'error');
        if (btn) btn.textContent = '▶ Run';
        return;
      }

      localRunState.runId = data.runId;
      localRunState.cursor = 0;

      localRunState.pollTimer = setInterval(async () => {
        if (!localRunState.runId) return;
        try {
          const url = `/__api__/run/node/logs?runId=${encodeURIComponent(localRunState.runId)}&cursor=${localRunState.cursor}`;
          const respLogs = await fetch(url);
          const logData = await respLogs.json().catch(() => null);
          if (!logData || !logData.success) {
            return;
          }

          const logs = logData.logs || [];
          logs.forEach((entry) => {
            const t = entry.type || 'log';
            const text = entry.text || '';
            if (!text) return;
            // Prefix stderr/info to distinguish
            if (t === 'stderr') {
              addOutputLine(text, 'error');
            } else if (t === 'stdout') {
              addOutputLine(text, 'log');
            } else {
              addOutputLine(text, t);
            }
          });

          localRunState.cursor = logData.cursor || localRunState.cursor;

          if (logData.exited) {
            if (btn) btn.textContent = '▶ Run';
            if (localRunState.pollTimer) {
              clearInterval(localRunState.pollTimer);
            }
            localRunState.runId = null;
            localRunState.pollTimer = null;
          }
        } catch {
          // Ignore transient polling errors
        }
      }, 700);
    } catch (e) {
      addOutputLine(e && e.message ? e.message : 'Failed to start local run.', 'error');
      if (btn) btn.textContent = '▶ Run';
    }
  }

  function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter => Run
      if (e.ctrlKey && e.key === 'Enter') {
        const tab = document.querySelector('.terminal-tab.active');
        const isCompiler = tab && tab.dataset && tab.dataset.tab === 'compiler';
        if (isCompiler) {
          e.preventDefault();
          run();
        }
      }
    });
  }

  function init() {
    const runBtn = $('compilerRunBtn');
    const useBtn = $('compilerUseFileLang');
    const stdinToggleBtn = $('compilerToggleStdin');
    const ioContainer = document.querySelector('#terminalCompiler .compiler-io');

    if (!runBtn) return;

    runBtn.addEventListener('click', () => run());
    if (useBtn) useBtn.addEventListener('click', () => pickLanguageFromFile());

    if (stdinToggleBtn && ioContainer) {
      stdinToggleBtn.addEventListener('click', () => {
        const collapsed = ioContainer.classList.toggle('no-stdin');
        stdinToggleBtn.textContent = collapsed ? 'Show stdin' : 'Hide stdin';
      });
    }

    // Best-effort: auto-pick on first load
    setTimeout(() => {
      try {
        pickLanguageFromFile();
      } catch {}
    }, 300);

    setupShortcuts();
  }

  return { init, run, pickLanguageFromFile };
})();

