#!/usr/bin/env node
/**
 * Drop this file into any project folder and run:
 *   node scan-folder.mjs
 *
 * Scans the folder that contains this script (not cwd) and writes, in that same folder:
 *   - manifest.json
 *   - manifest-inline.js   (window.__JJ_ARCHIVE__ = … for the archive viewer)
 *
 * Options:
 *   node scan-folder.mjs --include-node-modules
 *   node scan-folder.mjs --no-skip-git
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const includeNodeModules = argv.includes("--include-node-modules");
const skipGit = !argv.includes("--no-skip-git");

function walkDir(rootAbs) {
  const out = [];
  const skip = (name) => {
    if (!includeNodeModules && name === "node_modules") return true;
    if (skipGit && name === ".git") return true;
    return false;
  };
  function walk(current) {
    let dirents;
    try {
      dirents = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of dirents) {
      if (skip(e.name)) continue;
      const full = path.join(current, e.name);
      const rel = path.relative(rootAbs, full).replace(/\\/g, "/");
      if (rel === "scan-folder.mjs" || rel === "scan-folder.bat") continue;
      if (e.isDirectory()) {
        out.push({ type: "dir", path: rel + "/" });
        walk(full);
      } else {
        out.push({ type: "file", path: rel });
      }
    }
  }
  walk(rootAbs);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

const entries = walkDir(HERE);
const dirs = entries.filter((x) => x.type === "dir").length;
const files = entries.filter((x) => x.type === "file").length;

const manifest = {
  site: path.basename(HERE),
  serverRoot: HERE,
  generated: new Date().toISOString(),
  description: "scan-folder.mjs (drop-in)",
  fileCount: files,
  dirCount: dirs,
  entries,
};

const jsonPath = path.join(HERE, "manifest.json");
const jsPath = path.join(HERE, "manifest-inline.js");

fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), "utf8");
fs.writeFileSync(jsPath, `window.__JJ_ARCHIVE__=${JSON.stringify(manifest)};\n`, "utf8");

console.log(`Wrote:\n  ${jsonPath}\n  ${jsPath}`);
console.log(`— ${files} files, ${dirs} dirs`);
