window.PreviewEditorSetup = (function() {
  return {
    createEditor(editorContainer, language, previewSettings) {
      const editor = monaco.editor.create(editorContainer, {
        value: '',
        language: language,
        theme: previewSettings.editorTheme,
        fontSize: previewSettings.editorFontSize,
        fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
        lineNumbers: previewSettings.editorLineNumbers ? 'on' : 'off',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly: false,
        cursorStyle: 'line',
        automaticLayout: true,
        minimap: {
          enabled: true
        },
        wordWrap: previewSettings.editorWordWrap ? 'on' : 'off',
        formatOnPaste: true,
        formatOnType: true,
        tabSize: previewSettings.editorTabSize,
        insertSpaces: true,
        detectIndentation: true,
        renderWhitespace: 'selection',
        renderLineHighlight: 'all',
        bracketPairColorization: {
          enabled: true
        },
        // Code folding (collapse/expand functions, blocks) — chevrons in gutter
        folding: true,
        foldingStrategy: 'auto',
        foldingHighlight: true,
        showFoldingControls: 'always',
        glyphMargin: true,
        // Enhanced autocomplete/IntelliSense
        suggestOnTriggerCharacters: true,
        quickSuggestions: {
          other: true,
          comments: true,
          strings: true
        },
        quickSuggestionsDelay: 100,
        acceptSuggestionOnEnter: 'on',
        acceptSuggestionOnCommitCharacter: true,
        tabCompletion: 'on',
        wordBasedSuggestions: 'matchingDocuments',
        suggestSelection: 'first',
        snippetSuggestions: 'top',
        enableParameterHints: true,
        parameterHints: {
          enabled: true,
          cycle: true
        },
        // Cross-file definition preview on hover (see PreviewCrossModuleNavigation)
        hover: {
          enabled: true,
          delay: 350,
          sticky: true,
        },
      });

      // Register HTML-specific completions
      if (language === 'html') {
        monaco.languages.registerCompletionItemProvider('html', {
          provideCompletionItems: (model, position) => {
            const suggestions = [
              // Common HTML tags
              { label: 'div', kind: monaco.languages.CompletionItemKind.Class, insertText: '<div>$1</div>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'span', kind: monaco.languages.CompletionItemKind.Class, insertText: '<span>$1</span>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'p', kind: monaco.languages.CompletionItemKind.Class, insertText: '<p>$1</p>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'a', kind: monaco.languages.CompletionItemKind.Class, insertText: '<a href="$1">$2</a>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'img', kind: monaco.languages.CompletionItemKind.Class, insertText: '<img src="$1" alt="$2">', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'button', kind: monaco.languages.CompletionItemKind.Class, insertText: '<button>$1</button>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'input', kind: monaco.languages.CompletionItemKind.Class, insertText: '<input type="$1" name="$2">', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'form', kind: monaco.languages.CompletionItemKind.Class, insertText: '<form action="$1" method="$2">\n\t$3\n</form>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'ul', kind: monaco.languages.CompletionItemKind.Class, insertText: '<ul>\n\t<li>$1</li>\n</ul>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'ol', kind: monaco.languages.CompletionItemKind.Class, insertText: '<ol>\n\t<li>$1</li>\n</ol>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'table', kind: monaco.languages.CompletionItemKind.Class, insertText: '<table>\n\t<tr>\n\t\t<th>$1</th>\n\t</tr>\n\t<tr>\n\t\t<td>$2</td>\n\t</tr>\n</table>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'section', kind: monaco.languages.CompletionItemKind.Class, insertText: '<section>$1</section>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'article', kind: monaco.languages.CompletionItemKind.Class, insertText: '<article>$1</article>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'header', kind: monaco.languages.CompletionItemKind.Class, insertText: '<header>$1</header>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'footer', kind: monaco.languages.CompletionItemKind.Class, insertText: '<footer>$1</footer>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'nav', kind: monaco.languages.CompletionItemKind.Class, insertText: '<nav>$1</nav>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
              { label: 'main', kind: monaco.languages.CompletionItemKind.Class, insertText: '<main>$1</main>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet }
            ];
            return { suggestions };
          }
        });
      }

      return editor;
    },

    setupEditorListeners(editor, getFilePath, syncChannel, originalContent, isDirty, updateStatus, updatePreview, saveToEditorTimeout, isApplyingExternalChange, updateTabDirtyState) {
      editor.onDidChangeModelContent(() => {
        if (isApplyingExternalChange && isApplyingExternalChange.current) {
          return;
        }
        
        const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
        syncChannel.postMessage({
          type: 'editor-content',
          filePath: filePath,
          content: editor.getValue(),
          isDirty: editor.getValue() !== originalContent.current
        });
        
        const position = editor.getPosition();
        if (position) {
          syncChannel.postMessage({
            type: 'editor-cursor',
            filePath: filePath,
            position: position
          });
        }
        
        const currentContent = editor.getValue();
        isDirty.current = currentContent !== originalContent.current;
        updateStatus();
        updatePreview(currentContent);
        
        if (updateTabDirtyState && typeof updateTabDirtyState === 'function') {
          updateTabDirtyState();
        }
        
        if (saveToEditorTimeout.current) {
          clearTimeout(saveToEditorTimeout.current);
        }
        saveToEditorTimeout.current = setTimeout(() => {
          if (!filePath) {
            console.error('Cannot save to ide_editor_cache folder: filePath is not set');
            return;
          }
          
          fetch('/__api__/files/editor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, content: currentContent })
          })
          .then(res => res.json())
          .then(data => {
            if (!data.success) {
              console.error('Error saving to ide_editor_cache folder:', data.error);
            }
          })
          .catch(err => {
            console.error('Error saving to ide_editor_cache folder:', err);
          });
        }, 50);
      });
      
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const saveFile = window.__previewSaveFile;
        if (saveFile) {
          saveFile();
        }
      });

      // Jump to Definition on Ctrl+Click
      editor.onMouseDown((e) => {
        if (e.event.ctrlKey || e.event.metaKey) {
          e.event.preventDefault();
          e.event.stopPropagation();
          
          const position = e.target.position;
          if (position) {
            // Set position first, then jump to definition
            try {
              editor.setPosition(position);
              // Use our custom implementation
              if (window.PreviewEditorNavigation) {
                const getFilePath = typeof window.__previewFilePath === 'function' ? window.__previewFilePath : () => '';
                const switchToFile = window.__previewSwitchToFile || (() => {});
                // Use setTimeout to ensure position is set before jumping
                setTimeout(() => {
                  Promise.resolve(
                    window.PreviewEditorNavigation.jumpToDefinition(editor, getFilePath, switchToFile),
                  ).catch((err) => console.warn('Go to definition:', err));
                }, 10);
              }
            } catch (error) {
              console.error('Error in Ctrl+Click handler:', error);
            }
          }
        }
      });
    },

    setupEditorNavigation(editor, openSymbolNavigator) {
      // Register keyboard shortcut for Symbol Navigator (Ctrl+Shift+O)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyO, () => {
        if (window.PreviewEditorNavigation) {
          window.PreviewEditorNavigation.openSymbolNavigator(editor);
        } else if (openSymbolNavigator && typeof openSymbolNavigator === 'function') {
          openSymbolNavigator(editor);
        }
      });

      // Also register F12 for Go to Definition
      editor.addCommand(monaco.KeyCode.F12, () => {
        if (window.PreviewEditorNavigation) {
          const getFilePath = typeof window.__previewFilePath === 'function' ? window.__previewFilePath : () => '';
          const switchToFile = window.__previewSwitchToFile || (() => {});
          Promise.resolve(
            window.PreviewEditorNavigation.jumpToDefinition(editor, getFilePath, switchToFile),
          ).catch((err) => console.warn('Go to definition:', err));
        }
      });

      // Register Shift+F12 for Find All References
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F12, () => {
        if (window.PreviewEditorNavigation) {
          const getFilePath = typeof window.__previewFilePath === 'function' ? window.__previewFilePath : () => '';
          window.PreviewEditorNavigation.findReferences(editor, getFilePath);
        }
      });
    }
  };
})();
