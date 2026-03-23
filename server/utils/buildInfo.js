/**
 * App version from package.json (and optional build-info.json) for APIs and remote comparison.
 */
const fs = require('fs');
const path = require('path');

let cached = null;

function repoRoot() {
  return path.join(__dirname, '..', '..');
}

function readPackageJson(root) {
  try {
    const p = path.join(root, 'package.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      name: j.name != null ? String(j.name) : 'astrocode-editor',
      version: j.version != null ? String(j.version) : '0.0.0'
    };
  } catch (e) {
    return { name: 'astrocode-editor', version: '0.0.0' };
  }
}

function readOptionalBuildInfoJson(root) {
  try {
    const p = path.join(root, 'build-info.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * @returns {{ name: string, version: string }}
 */
function getBuildInfo() {
  if (cached) {
    return cached;
  }
  const root = repoRoot();
  const pkg = readPackageJson(root);
  const extra = readOptionalBuildInfoJson(root);
  if (extra && extra.version != null && String(extra.version).trim()) {
    pkg.version = String(extra.version).trim();
  }
  if (process.env.ASTRO_APP_VERSION && String(process.env.ASTRO_APP_VERSION).trim()) {
    pkg.version = String(process.env.ASTRO_APP_VERSION).trim();
  }
  cached = {
    name: pkg.name,
    version: pkg.version
  };
  return cached;
}

function resetCacheForTests() {
  cached = null;
}

module.exports = {
  getBuildInfo,
  resetCacheForTests
};
