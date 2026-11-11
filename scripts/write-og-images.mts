// TanStack Start's prerender saves every response through `res.text()`, which corrupts binary
// bodies. This asks the built server for each prerendered OG image again and writes the raw bytes.
import { readdirSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { siteConfig } from "../config/site.ts";

type ServerEntry = { default: { fetch(request: Request): Promise<Response> } };

const dist = join(process.cwd(), "dist");
const ogDir = join(dist, "client", "og");
const { default: server } = (await import(
  pathToFileURL(join(dist, "server", "server.js")).href
)) as ServerEntry;

const images = readdirSync(ogDir, { recursive: true, encoding: "utf8" }).filter((file) =>
  file.endsWith(".png"),
);

for (const file of images) {
  const path = `${siteConfig.basepath}/og/${file.split(sep).join("/")}`;
  const res = await server.fetch(new Request(`http://localhost${path}`));
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) {
    throw new Error(`[og] ${path} answered ${res.status} ${type}`);
  }
  writeFileSync(join(ogDir, file), Buffer.from(await res.arrayBuffer()));
}

console.log(`[og] wrote ${images.length} images`);
