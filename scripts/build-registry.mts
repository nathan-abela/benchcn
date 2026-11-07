// Writes registry.json from registry/registry.ts, runs shadcn build, and copies the index
// to public/r/registry.json so the registry root is flat (a shadcn directory requirement).
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { siteConfig } from "../config/site.ts";
import { registry } from "../registry/registry.ts";

const HEADER = siteConfig.registry.fileHeader;

for (const item of registry) {
  for (const file of item.files ?? []) {
    const first = readFileSync(file.path, "utf8").split("\n", 1)[0];
    if (!first.startsWith(HEADER)) {
      throw new Error(`${file.path} must start with "${HEADER}${item.name}"`);
    }
  }
}

const manifest = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: siteConfig.name,
  homepage: siteConfig.url,
  items: registry.map((item) => ({
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    ...item,
  })),
};

writeFileSync("registry.json", `${JSON.stringify(manifest, null, 2)}\n`);
execSync("pnpm exec shadcn build", { stdio: "inherit" });
mkdirSync("public/r", { recursive: true });
copyFileSync("registry.json", "public/r/registry.json");
console.log(`registry: ${registry.length} items -> public/r`);
