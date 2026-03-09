window.PreviewEditorNavigation = (function() {
  let referencesDialog = null;

  function createReferencesDialog() {
    if (referencesDialog) return referencesDialog;

    referencesDialog = document.createElement('div');
    referencesDialog.className = 'references-dialog';
    referencesDialog.innerHTML = `
      <div class="references-content">
        <div class="references-header">
          <span class="references-title">Find All References</span>
          <button class="references-close" id="referencesClose">✕</button>
        </div>
        <div class="references-body">
          <div class="references-info" id="referencesInfo"></div>
          <div class="references-results" id="referencesResults"></div>
        </div>
      </div>
    `;
    document.body.appendChild(referencesDialog);
    return referencesDialog;
  }

  function findSymbolAtPosition(editor, position) {
    const model = editor.getModel();
    if (!model) return null;

    const word = model.getWordAtPosition(position);
    if (!word) return null;

    return {
      word: word.word,
      range: {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn
      }
    };
  }

  function findDefinitionInFile(content, symbol, currentLine, currentCol) {
    const lines = content.split('\n');
    const symbolRegex = new RegExp(`\\b(function|class|const|let|var)\\s+${symbol}\\b`, 'i');
    
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(symbolRegex);
      if (match) {
        return {
          line: i + 1,
          column: match.index + 1,
          match: match[0]
        };
      }
    }
    
    return null;
  }

  function findAllReferences(content, symbol, currentLine, currentCol) {
    const lines = content.split('\n');
    const references = [];
    const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'g');
    
    for (let i = 0; i < lines.length; i++) {
      let match;
      while ((match = symbolRegex.exec(lines[i])) !== null) {
        // Skip the definition itself if it's a function/class declaration
        const isDefinition = /^\s*(function|class|const|let|var)\s+/.test(lines[i].substring(0, match.index));
        if (isDefinition && i === currentLine - 1) {
          continue;
        }
        
        references.push({
          line: i + 1,
          column: match.index + 1,
          text: lines[i].trim(),
          isDefinition: isDefinition && i !== currentLine - 1
        });
      }
    }
    
    return references;
  }

  function jumpToDefinition(editor, getFilePath, switchToFile) {
    const position = editor.getPosition();
    if (!position) {
      console.log('No cursor position');
      return;
    }

    const symbol = findSymbolAtPosition(editor, position);
    if (!symbol) {
      console.log('No symbol found at cursor position');
      return;
    }

    const model = editor.getModel();
    if (!model) {
      console.log('No editor model');
      return;
    }
    
    const content = model.getValue();
    
    // First, try to find definition in current file
    const definition = findDefinitionInFile(content, symbol.word, position.lineNumber, position.column);
    
    if (definition) {
      try {
        editor.setPosition({ lineNumber: definition.line, column: definition.column });
        editor.revealLineInCenter(definition.line);
        return;
      } catch (error) {
        console.error('Error setting position:', error);
      }
    }

    // Try Monaco's built-in action as fallback
    const action = editor.getAction('editor.action.revealDefinition');
    if (action && action.isSupported()) {
      action.run();
      return;
    }

    console.log(`Definition not found for: ${symbol.word}`);
  }

  function findReferences(editor, getFilePath) {
    const position = editor.getPosition();
    if (!position) return;

    const symbol = findSymbolAtPosition(editor, position);
    if (!symbol) {
      console.log('No symbol found at cursor position');
      return;
    }

    const model = editor.getModel();
    const content = model.getValue();
    const references = findAllReferences(content, symbol.word, position.lineNumber, position.column);

    if (references.length === 0) {
      console.log(`No references found for: ${symbol.word}`);
      return;
    }

    // Show references dialog
    if (!referencesDialog) {
      createReferencesDialog();
    }

    const info = referencesDialog.querySelector('#referencesInfo');
    const results = referencesDialog.querySelector('#referencesResults');
    const closeBtn = referencesDialog.querySelector('#referencesClose');

    info.textContent = `Found ${references.length} reference${references.length !== 1 ? 's' : ''} for "${symbol.word}"`;
    results.innerHTML = '';

    references.forEach(ref => {
      const item = document.createElement('div');
      item.className = 'references-item';
      item.innerHTML = `
        <span class="references-line">${ref.line}:${ref.column}</span>
        <span class="references-text">${escapeHtml(ref.text)}</span>
      `;
      item.addEventListener('click', () => {
        editor.setPosition({ lineNumber: ref.line, column: ref.column });
        editor.revealLineInCenter(ref.line);
        closeReferences();
      });
      results.appendChild(item);
    });

    referencesDialog.style.display = 'flex';

    closeBtn.addEventListener('click', closeReferences);
    referencesDialog.addEventListener('click', (e) => {
      if (e.target === referencesDialog) closeReferences();
    });
  }

  function closeReferences() {
    if (referencesDialog) {
      referencesDialog.style.display = 'none';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function extractSymbols(content, language) {
    const symbols = [];
    const lines = content.split('\n');

    // Function definitions
    const functionRegex = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
    // Class definitions
    const classRegex = /^\s*(?:export\s+)?class\s+(\w+)/;
    // Variable/const declarations
    const varRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]/;
    // Method definitions (in classes)
    const methodRegex = /^\s*(\w+)\s*\([^)]*\)\s*\{/;

    lines.forEach((line, index) => {
      let match;
      
      if ((match = line.match(functionRegex))) {
        symbols.push({
          name: match[1],
          line: index + 1,
          kind: 'Function',
          icon: '🔹'
        });
      } else if ((match = line.match(classRegex))) {
        symbols.push({
          name: match[1],
          line: index + 1,
          kind: 'Class',
          icon: '🔷'
        });
      } else if ((match = line.match(varRegex))) {
        symbols.push({
          name: match[1],
          line: index + 1,
          kind: 'Variable',
          icon: '🔸'
        });
      } else if ((match = line.match(methodRegex))) {
        symbols.push({
          name: match[1],
          line: index + 1,
          kind: 'Method',
          icon: '🔹'
        });
      }
    });

    return symbols;
  }

  function openSymbolNavigator(editor) {
    const model = editor.getModel();
    if (!model) return;

    const content = model.getValue();
    const language = model.getLanguageId();
    const symbols = extractSymbols(content, language);

    // Try Monaco's built-in first
    const action = editor.getAction('editor.action.gotoSymbol');
    if (action && action.isSupported()) {
      action.run();
      return;
    }

    // Fallback: Show custom dialog
    if (!window.PreviewSymbolNavigator) {
      console.warn('Symbol Navigator not available');
      return;
    }

    // Use the symbol navigator module
    window.PreviewSymbolNavigator.openWithSymbols(editor, symbols);
  }

  return {
    jumpToDefinition,
    findReferences,
    openSymbolNavigator,
    closeReferences
  };
})();
