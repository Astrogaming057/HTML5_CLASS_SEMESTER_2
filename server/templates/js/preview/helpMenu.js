window.PreviewHelpMenu = (function() {
  let dialog = null;

  function createDialog() {
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.className = 'help-menu-dialog';
    dialog.innerHTML = `
      <div class="help-menu-content">
        <div class="help-menu-header">
          <span class="help-menu-title">Help & Keyboard Shortcuts</span>
          <button class="help-menu-close" id="helpMenuClose">✕</button>
        </div>
        <div class="help-menu-body">
          <div class="help-section">
            <h3 class="help-section-title">Keyboard Shortcuts</h3>
            <div class="help-shortcuts">
              <div class="help-shortcut-item">
                <span class="help-shortcut-key">Ctrl + P</span>
                <span class="help-shortcut-desc">Quick Open - Search and open files</span>
              </div>
              <div class="help-shortcut-item">
                <span class="help-shortcut-key">Ctrl + Shift + F</span>
                <span class="help-shortcut-desc">Global Search - Search across all files</span>
              </div>
              <div class="help-shortcut-item">
                <span class="help-shortcut-key">Ctrl + S</span>
                <span class="help-shortcut-desc">Save current file</span>
              </div>
              <div class="help-shortcut-item">
                <span class="help-shortcut-key">Ctrl + B</span>
                <span class="help-shortcut-desc">Toggle file explorer</span>
              </div>
              <div class="help-shortcut-item">
                <span class="help-shortcut-key">Ctrl + ?</span>
                <span class="help-shortcut-desc">Show this help menu</span>
              </div>
              <div class="help-shortcut-item">
                <span class="help-shortcut-key">Esc</span>
                <span class="help-shortcut-desc">Close dialogs and menus</span>
              </div>
            </div>
          </div>

          <div class="help-section">
            <h3 class="help-section-title">Features</h3>
            <div class="help-features">
              <div class="help-feature-item">
                <strong>Tab System</strong>
                <p>Open multiple files in tabs. Switch between them without losing your work. White dot indicates unsaved changes.</p>
              </div>
              <div class="help-feature-item">
                <strong>Preview Pinning</strong>
                <p>Pin the preview to a specific page while switching files. Click the pin button (📌) in the preview header.</p>
              </div>
              <div class="help-feature-item">
                <strong>Git Panel</strong>
                <p>View modified files, stage changes, and commit. Click the Git button (📦) in the file explorer header.</p>
              </div>
              <div class="help-feature-item">
                <strong>Live Preview</strong>
                <p>See your changes instantly in the preview. CSS and JS files are automatically loaded from cache for HTML pages.</p>
              </div>
              <div class="help-feature-item">
                <strong>Auto-complete</strong>
                <p>IntelliSense support with HTML snippets and code completion. Press Tab to accept suggestions.</p>
              </div>
              <div class="help-feature-item">
                <strong>File Explorer</strong>
                <p>Right-click files for context menu. Drag and drop to move files. Modified files show an "M" indicator.</p>
              </div>
            </div>
          </div>

          <div class="help-section">
            <h3 class="help-section-title">Tips</h3>
            <div class="help-tips">
              <ul>
                <li>Use <strong>Ctrl + P</strong> to quickly jump to any file in your project</li>
                <li>Search across all files with <strong>Ctrl + Shift + F</strong> to find code references</li>
                <li>Pin the preview when you want to keep viewing a specific page while editing other files</li>
                <li>Modified files are automatically detected - check the Git panel to see all changes</li>
                <li>Settings are saved automatically and persist across sessions</li>
                <li>Use the terminal tabs for client-side JavaScript, server logs, and server commands</li>
                <li>Right-click in the file explorer to create new files/folders, rename, or delete</li>
              </ul>
            </div>
          </div>

          <div class="help-section">
            <h3 class="help-section-title">Editor Features</h3>
            <div class="help-editor-features">
              <ul>
                <li><strong>Monaco Editor</strong> - Full-featured code editor with syntax highlighting</li>
                <li><strong>Multiple Themes</strong> - Choose from 30+ themes in Settings</li>
                <li><strong>Tab Management</strong> - Open multiple files, see unsaved changes with white dot</li>
                <li><strong>Auto-save to Cache</strong> - Changes are automatically saved to cache for preview</li>
                <li><strong>Format on Type</strong> - Code is automatically formatted as you type</li>
                <li><strong>Bracket Matching</strong> - Visual indicators for matching brackets</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="help-menu-footer">
          <button class="btn btn-primary" id="helpMenuCloseBtn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    const closeBtn = dialog.querySelector('#helpMenuClose');
    const closeBtnFooter = dialog.querySelector('#helpMenuCloseBtn');

    closeBtn.addEventListener('click', () => close());
    if (closeBtnFooter) {
      closeBtnFooter.addEventListener('click', () => close());
    }
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });

    return dialog;
  }

  function close() {
    if (dialog) {
      dialog.style.display = 'none';
    }
  }

  return {
    open() {
      const dialogEl = createDialog();
      dialogEl.style.display = 'flex';
    },

    close
  };
})();
