/**
 * IDE-style file type → CSS class for explorer icons (styled in preview.css).
 */
window.PreviewFileIcons = (function() {
  const exactNames = {
    'package.json': 'file-icon-npm-json',
    'package-lock.json': 'file-icon-npm-lock',
    'pnpm-lock.yaml': 'file-icon-yaml',
    'yarn.lock': 'file-icon-yarn',
    'tsconfig.json': 'file-icon-tsconfig',
    'jsconfig.json': 'file-icon-jsconfig',
    '.gitignore': 'file-icon-git',
    '.gitattributes': 'file-icon-git',
    '.gitmodules': 'file-icon-git',
    '.editorconfig': 'file-icon-config',
    '.npmrc': 'file-icon-npm',
    '.nvmrc': 'file-icon-node',
    '.prettierrc': 'file-icon-prettier',
    '.prettierrc.json': 'file-icon-prettier',
    '.eslintrc': 'file-icon-eslint',
    '.eslintrc.json': 'file-icon-eslint',
    'dockerfile': 'file-icon-docker',
    'makefile': 'file-icon-make',
    'cmakelists.txt': 'file-icon-make',
    '.env': 'file-icon-env',
    '.env.local': 'file-icon-env',
    '.env.example': 'file-icon-env'
  };

  const extMap = {
    '.json': 'file-icon-json',
    '.js': 'file-icon-js',
    '.mjs': 'file-icon-js',
    '.cjs': 'file-icon-js',
    '.jsx': 'file-icon-react',
    '.ts': 'file-icon-ts',
    '.tsx': 'file-icon-react-ts',
    '.d.ts': 'file-icon-ts-def',
    '.html': 'file-icon-html',
    '.htm': 'file-icon-html',
    '.css': 'file-icon-css',
    '.scss': 'file-icon-scss',
    '.sass': 'file-icon-scss',
    '.less': 'file-icon-css',
    '.md': 'file-icon-md',
    '.markdown': 'file-icon-md',
    '.xml': 'file-icon-xml',
    '.svg': 'file-icon-svg',
    '.yaml': 'file-icon-yaml',
    '.yml': 'file-icon-yaml',
    '.py': 'file-icon-py',
    '.rs': 'file-icon-rust',
    '.go': 'file-icon-go',
    '.java': 'file-icon-java',
    '.kt': 'file-icon-kotlin',
    '.kts': 'file-icon-kotlin',
    '.cs': 'file-icon-csharp',
    '.cpp': 'file-icon-cpp',
    '.cc': 'file-icon-cpp',
    '.cxx': 'file-icon-cpp',
    '.c': 'file-icon-c',
    '.h': 'file-icon-h',
    '.hpp': 'file-icon-cpp',
    '.rb': 'file-icon-ruby',
    '.php': 'file-icon-php',
    '.swift': 'file-icon-swift',
    '.sql': 'file-icon-sql',
    '.sh': 'file-icon-shell',
    '.bash': 'file-icon-shell',
    '.zsh': 'file-icon-shell',
    '.ps1': 'file-icon-powershell',
    '.bat': 'file-icon-windows',
    '.cmd': 'file-icon-windows',
    '.exe': 'file-icon-binary',
    '.msi': 'file-icon-binary',
    '.dll': 'file-icon-binary',
    '.zip': 'file-icon-zip',
    '.7z': 'file-icon-zip',
    '.tar': 'file-icon-zip',
    '.gz': 'file-icon-zip',
    '.rar': 'file-icon-zip',
    '.png': 'file-icon-image',
    '.jpg': 'file-icon-image',
    '.jpeg': 'file-icon-image',
    '.gif': 'file-icon-image',
    '.webp': 'file-icon-image',
    '.ico': 'file-icon-image',
    '.bmp': 'file-icon-image',
    '.mp4': 'file-icon-video',
    '.webm': 'file-icon-video',
    '.mp3': 'file-icon-audio',
    '.wav': 'file-icon-audio',
    '.woff': 'file-icon-font',
    '.woff2': 'file-icon-font',
    '.ttf': 'file-icon-font',
    '.otf': 'file-icon-font',
    '.eot': 'file-icon-font',
    '.graphql': 'file-icon-graphql',
    '.gql': 'file-icon-graphql',
    '.vue': 'file-icon-vue',
    '.svelte': 'file-icon-svelte',
    '.lua': 'file-icon-lua',
    '.vim': 'file-icon-config',
    '.log': 'file-icon-log',
    '.txt': 'file-icon-text',
    '.ini': 'file-icon-config',
    '.toml': 'file-icon-config',
    '.lock': 'file-icon-lock'
  };

  function baseName(fileName) {
    const parts = String(fileName || '').split(/[/\\]/);
    return parts.pop() || parts[0] || '';
  }

  function getIconClass(fileName, isDirectory) {
    if (isDirectory) {
      return 'file-icon-folder';
    }
    const base = baseName(fileName);
    const lower = base.toLowerCase();

    if (exactNames[lower]) {
      return exactNames[lower];
    }
    if (lower.startsWith('readme')) {
      return 'file-icon-readme';
    }
    if (lower.startsWith('license') || lower.startsWith('licence') || lower === 'copying') {
      return 'file-icon-license';
    }
    if (lower.startsWith('.env')) {
      return 'file-icon-env';
    }

    if (lower.endsWith('.d.ts')) {
      return extMap['.d.ts'];
    }

    const dot = lower.lastIndexOf('.');
    const ext = dot >= 0 ? lower.slice(dot) : '';
    if (ext && extMap[ext]) {
      return extMap[ext];
    }

    return 'file-icon-generic';
  }

  /**
   * Configure a file-tree icon span (clears text; uses CSS ::before for glyph).
   */
  function applyToIcon(iconEl, fileName, isDirectory) {
    if (!iconEl) return;
    if (isDirectory) {
      iconEl.className = 'file-tree-item-icon';
      iconEl.textContent = '';
      return;
    }
    const cls = getIconClass(fileName, false);
    iconEl.className = 'file-tree-item-icon file-icon ' + cls;
    iconEl.textContent = '';
  }

  return {
    getIconClass,
    applyToIcon
  };
})();
