// Serves dist/client the way GitHub Pages would: under the site basepath, with 404.html fallback.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";

import { siteConfig } from "../config/site.ts";

const port = Number(process.argv[2] ?? 4173);
const root = join(process.cwd(), "dist", "client");
const base = siteConfig.basepath.replace(/\/$/, "");

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolve(url: string) {
  const path = decodeURIComponent(new URL(url, "http://localhost").pathname);
  if (base && !path.startsWith(`${base}/`) && path !== base) return null;
  const rel = (path.slice(base.length) || "/")
    .split("/")
    .filter((segment) => segment !== "" && segment !== "..")
    .join("/");
  const candidates = [join(root, rel), join(root, rel, "index.html"), join(root, `${rel}.html`)];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

createServer((req, res) => {
  const file = resolve(req.url ?? "/");
  if (file) {
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
    return;
  }
  const notFound = join(root, "404.html");
  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  if (existsSync(notFound)) createReadStream(notFound).pipe(res);
  else res.end("Not found");
}).listen(port, () => {
  console.log(`serving ${root} at http://localhost:${port}${base}/`);
});
