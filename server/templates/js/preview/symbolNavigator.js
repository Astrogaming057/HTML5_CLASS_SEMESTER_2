window.PreviewSymbolNavigator = (function() {
  let dialog = null;

  function createDialog() {
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.className = 'symbol-navigator-dialog';
    dialog.innerHTML = `
      <div class="symbol-navigator-content">
        <div class="symbol-navigator-header">
          <span class="symbol-navigator-title">Go to Symbol in File</span>
          <button class="symbol-navigator-close" id="symbolNavigatorClose">✕</button>
        </div>
        <div class="symbol-navigator-body">
          <input type="text" class="symbol-navigator-input" id="symbolNavigatorInput" placeholder="Type symbol name...">
          <div class="symbol-navigator-results" id="symbolNavigatorResults"></div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    return dialog;
  }

  function open(editor) {
    if (!editor) {
      console.warn('Symbol Navigator: Editor not available');
      return;
    }

    // Use Monaco's built-in symbol navigation (Go to Symbol in File)
    // This is the standard VSCode action that provides symbol search
    const action = editor.getAction('editor.action.gotoSymbol');
    if (action && action.isSupported()) {
      action.run();
      return;
    }

    // Fallback: Try alternative action names
    const altAction = editor.getAction('editor.action.showSymbols');
    if (altAction && altAction.isSupported()) {
      altAction.run();
      return;
    }

    console.warn('Symbol Navigator: Symbol navigation not available for this language');
  }

  function openWithSymbols(editor, symbols) {
    if (!editor) {
      console.warn('Symbol Navigator: Editor not available');
      return;
    }

    if (!dialog) {
      createDialog();
    }

    const input = dialog.querySelector('#symbolNavigatorInput');
    const results = dialog.querySelector('#symbolNavigatorResults');
    const closeBtn = dialog.querySelector('#symbolNavigatorClose');

    dialog.style.display = 'flex';
    input.value = '';
    results.innerHTML = '';

    let filteredSymbols = symbols;

    function updateResults() {
      const query = input.value.toLowerCase();
      results.innerHTML = '';

      if (query.length === 0) {
        filteredSymbols = symbols;
      } else {
        filteredSymbols = symbols.filter(s => 
          s.name.toLowerCase().includes(query)
        );
      }

      if (filteredSymbols.length === 0) {
        results.innerHTML = '<div class="symbol-navigator-placeholder">No symbols found</div>';
        return;
      }

      filteredSymbols.forEach(symbol => {
        const item = document.createElement('div');
        item.className = 'symbol-navigator-item';
        item.innerHTML = `
          <span class="symbol-navigator-icon">${symbol.icon || '📄'}</span>
          <span class="symbol-navigator-name">${escapeHtml(symbol.name)}</span>
          <span class="symbol-navigator-location">Line ${symbol.line}</span>
        `;
        item.addEventListener('click', () => {
          editor.setPosition({ lineNumber: symbol.line, column: 1 });
          editor.revealLineInCenter(symbol.line);
          close();
        });
        results.appendChild(item);
      });
    }

    input.addEventListener('input', updateResults);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'Enter') {
        const firstItem = results.querySelector('.symbol-navigator-item');
        if (firstItem) {
          firstItem.click();
        }
      }
    });

    closeBtn.addEventListener('click', close);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });

    setTimeout(() => {
      input.focus();
    }, 100);

    updateResults();
  }

  function close() {
    if (dialog) {
      dialog.style.display = 'none';
    }
  }

  function getSymbolIcon(kind) {
    const icons = {
      'File': '📄',
      'Module': '📦',
      'Namespace': '📁',
      'Package': '📦',
      'Class': '🔷',
      'Method': '🔹',
      'Property': '🔸',
      'Field': '🔹',
      'Constructor': '🔷',
      'Enum': '📋',
      'Interface': '🔷',
      'Function': '🔹',
      'Variable': '🔸',
      'Constant': '🔸',
      'String': '📝',
      'Number': '🔢',
      'Boolean': '✓',
      'Array': '📋',
      'Object': '📦',
      'Key': '🔑',
      'Null': '⚪',
      'EnumMember': '🔸',
      'Struct': '🔷',
      'Event': '📢',
      'Operator': '⚙️',
      'TypeParameter': '🔷'
    };
    return icons[kind] || '📄';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    open,
    openWithSymbols,
    close
  };
})();
