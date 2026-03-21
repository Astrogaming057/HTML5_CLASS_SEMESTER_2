/**
 * Regenerates archives/index.json from subfolders of archives/ that contain manifest.json.
 * Run from archive_jj: node scripts/build-archives-index.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVES = path.join(__dirname, "..", "archives");

const archives = [];
for (const name of fs.readdirSync(ARCHIVES, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  if (name.name === ".git") continue;
  const manifest = path.join(ARCHIVES, name.name, "manifest.json");
  if (!fs.existsSync(manifest)) continue;
  archives.push({
    id: name.name,
    label: name.name.replace(/_/g, " "),
  });
}
archives.sort((a, b) => a.id.localeCompare(b.id));

const out = { archives };
fs.writeFileSync(path.join(ARCHIVES, "index.json"), JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote archives/index.json (${archives.length} entries)`);
