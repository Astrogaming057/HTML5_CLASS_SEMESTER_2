/**
 * App version + git commit for RPC/version headers and remote device comparison.
 * Set ASTRO_GIT_COMMIT or GIT_COMMIT in CI when .git is not present (e.g. packaged builds).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

function readGitShort(root) {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true
    }).trim();
  } catch (e) {
    return '';
  }
}

/**
 * @returns {{ name: string, version: string, commit: string }}
 */
function getBuildInfo() {
  if (cached) {
    return cached;
  }
  const root = repoRoot();
  const pkg = readPackageJson(root);
  const extra = readOptionalBuildInfoJson(root);
  let commit =
    process.env.ASTRO_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    (extra && extra.commit != null ? String(extra.commit).trim() : '');
  if (!commit) {
    commit = readGitShort(root);
  }
  if (extra && extra.version != null && String(extra.version).trim()) {
    pkg.version = String(extra.version).trim();
  }
  cached = {
    name: pkg.name,
    version: pkg.version,
    commit: commit || 'unknown'
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
