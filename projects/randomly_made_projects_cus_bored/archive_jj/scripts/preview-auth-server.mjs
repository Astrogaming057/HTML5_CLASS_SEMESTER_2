/**
 * Serves the archive_jj folder and exposes POST /api/preview-auth.
 * Default: always 401 { ok: false, error: "Wrong password" } (replace with your API).
 *
 * index.html expects a successful login as HTTP 2xx with JSON:
 *   { "ok": true, "token": "..." }   (token optional; used as Bearer for preview GET)
 *
 * Run from archive_jj: node scripts/preview-auth-server.mjs
 * Open: http://localhost:8789/index.html — missing files respond with 404.html.
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const NOT_FOUND_HTML = path.join(ROOT, "404.html");
const PORT = Number(process.env.PORT) || 8789;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

function send(res, status, body, headers) {
  res.writeHead(status, headers || {});
  res.end(body);
}

function corsJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("end", function () {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async function (req, res) {
  var url = req.url || "/";
  var q = url.indexOf("?");
  if (q !== -1) url = url.slice(0, q);

  if (req.method === "OPTIONS" && url === "/api/preview-auth") {
    send(res, 204, "", {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return;
  }

  if (req.method === "POST" && url === "/api/preview-auth") {
    try {
      await readBody(req);
    } catch (e) {}
    corsJson(res, 401, { ok: false, error: "Wrong password" });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed");
    return;
  }

  var filePath = path.normalize(path.join(ROOT, url === "/" ? "index.html" : url));
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, function (err, st) {
    if (err || !st.isFile()) {
      fs.readFile(NOT_FOUND_HTML, "utf8", function (e2, html) {
        if (e2 || !html) {
          send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
          return;
        }
        send(res, 404, html, { "Content-Type": "text/html; charset=utf-8" });
      });
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    var type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, function () {
  console.log("archive_jj preview server http://localhost:" + PORT + "/index.html");
  console.log("POST /api/preview-auth — always 401 Wrong password");
});
