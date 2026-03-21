/**
 * Strips sensitive paths from published archive manifests and adds placeholder files.
 * Run from archive_jj: node scripts/redact-sensitive-manifests.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVES = path.join(__dirname, "..", "archives");

function shouldRemoveBackend(p) {
  const n = p.replace(/\\/g, "/");
  if (n === "cache/") return true;
  if (n.startsWith("cache/")) return true;
  if (n.includes("/cache/")) return true;
  return false;
}

function shouldRemoveWebServer(p) {
  const n = p.replace(/\\/g, "/").toLowerCase();
  if (n.includes("/logs/") || n.startsWith("logs/")) return true;
  if (n.includes("/tickets/") || n.startsWith("tickets/")) return true;
  if (n.includes("/users/") || n.startsWith("users/")) return true;
  if (n.includes("/geolocationmap/") || n.startsWith("geolocationmap/")) return true;
  if (n.includes("/exports/") || n.startsWith("exports/")) return true;
  if (n.includes("/ssl/") || n.startsWith("ssl/")) return true;
  if (n.includes("/kv/") || n.startsWith("kv/")) return true;
  if (n === "cache/") return true;
  if (n.startsWith("cache/")) return true;
  if (n.includes("/cache/")) return true;
  return false;
}

function writeArchive(id, filterFn, placeholderFiles) {
  const dir = path.join(ARCHIVES, id);
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.warn("skip (no manifest):", id);
    return;
  }
  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entries = (raw.entries || []).filter((e) => !filterFn(e.path));

  const seen = new Set(entries.map((e) => e.path));
  for (const ph of placeholderFiles) {
    if (!seen.has(ph.path)) {
      entries.push({ type: "file", path: ph.path, redacted: true });
      seen.add(ph.path);
    }
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));

  const fileCount = entries.filter((e) => e.type === "file").length;
  const dirCount = entries.filter((e) => e.type === "dir").length;

  const desc = raw.description || "";
  const redactNote = " — sensitive paths removed from this public copy";
  const description = desc.includes("sensitive paths removed")
    ? desc
    : desc + redactNote;

  const manifest = {
    site: raw.site,
    serverRoot: "[redacted]",
    generated: new Date().toISOString(),
    description,
    fileCount,
    dirCount,
    entries,
  };

  const outJson = path.join(dir, "manifest.json");
  const outJs = path.join(dir, "manifest-inline.js");
  fs.writeFileSync(outJson, JSON.stringify(manifest, null, 2), "utf8");
  fs.writeFileSync(
    outJs,
    `window.__JJ_ARCHIVE__=${JSON.stringify(manifest)};\n`,
    "utf8"
  );
  console.log(id, "→", fileCount, "files,", dirCount, "dirs");
}

writeArchive("backend_isle_bot", shouldRemoveBackend, [
  { path: "cache/[REDACTED].txt" },
]);

writeArchive("web_server", shouldRemoveWebServer, [
  { path: "Clusters/logs/[REDACTED].txt" },
  { path: "Clusters/Web_server/images/tickets/[REDACTED].txt" },
  { path: "Clusters/Web_server/images/users/[REDACTED].txt" },
  { path: "Clusters/Web_server/images/logins/geolocationmap/[REDACTED].txt" },
  { path: "Clusters/Web_server/images/exports/[REDACTED].txt" },
  { path: "Clusters/Web_server/ssl/[REDACTED].txt" },
  { path: "Workers/static-cdn/.wrangler/state/v3/kv/[REDACTED].txt" },
  { path: "Workers/static-cdn/.wrangler/state/v3/cache/[REDACTED].txt" },
  { path: "Workers/filters/.wrangler/state/v3/cache/[REDACTED].txt" },
  { path: "Workers/statuspage/.wrangler/state/v3/cache/[REDACTED].txt" },
]);

console.log("Done.");
