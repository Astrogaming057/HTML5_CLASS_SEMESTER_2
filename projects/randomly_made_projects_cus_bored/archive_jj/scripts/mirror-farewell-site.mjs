#!/usr/bin/env node
/**
 * Downloads every file listed in archives/farewell.jurassicjungle.gg/manifest.json
 * from manifest.mirrorSource (https://farewell.jurassicjungle.gg).
 *
 * Run from archive_jj:
 *   node scripts/mirror-farewell-site.mjs
 *   node scripts/mirror-farewell-site.mjs --only-missing
 *
 * Optional: pass another archive folder that has manifest.json + mirrorSource:
 *   node scripts/mirror-farewell-site.mjs archives/some.site
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVE_JJ = path.join(__dirname, "..");
const DEFAULT_ROOT = path.join(ARCHIVE_JJ, "archives", "farewell.jurassicjungle.gg");

function writeManifestInline(root, manifest) {
  const out = path.join(root, "manifest-inline.js");
  const payload = { ...manifest, generated: new Date().toISOString() };
  fs.writeFileSync(
    out,
    `window.__JJ_ARCHIVE__=${JSON.stringify(payload)};\n`,
    "utf8"
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const onlyMissing = argv.includes("--only-missing");
  const rootArg = argv.find((a) => !a.startsWith("--"));
  const root = path.resolve(rootArg || DEFAULT_ROOT);
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("No manifest.json at:", manifestPath);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const base = String(manifest.mirrorSource || "").replace(/\/$/, "");
  if (!base) {
    console.error("manifest.json must include mirrorSource (e.g. https://farewell.jurassicjungle.gg)");
    process.exit(1);
  }

  const entries = manifest.entries || [];
  const files = entries.filter((e) => e.type === "file");
  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (const e of files) {
    const rel = String(e.path).replace(/\\/g, "/");
    const outPath = path.join(root, ...rel.split("/").filter(Boolean));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    if (onlyMissing && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      console.log("SKIP (exists)", rel);
      skip++;
      continue;
    }

    const url =
      base +
      "/" +
      rel
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/");

    let res;
    try {
      res = await fetch(url, {
        redirect: "follow",
        headers: { Accept: "*/*" },
      });
    } catch (err) {
      console.error("FETCH", rel, err && err.message ? err.message : err);
      fail++;
      continue;
    }
    if (!res.ok) {
      if (res.status === 404 && fs.existsSync(outPath)) {
        console.log("SKIP (remote 404, local file kept)", rel);
        skip++;
        continue;
      }
      console.error("HTTP", res.status, rel, "←", url);
      fail++;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    console.log("OK", rel, "(" + buf.length + " bytes)");
    ok++;
  }

  writeManifestInline(root, manifest);
  console.log("—", ok, "downloaded,", skip, "skipped,", fail, "failed");
  console.log("Updated manifest-inline.js");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
