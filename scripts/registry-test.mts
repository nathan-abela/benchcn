// Installs every registry item into a fresh Vite + shadcn project the way a user would, then checks
// that the documented import paths exist, the project typechecks and builds under the template's
// strict settings, and the blocks render without errors or warnings. Run `pnpm build` first.
//
// The scaffolded project is cached in .cache/install-test; delete it to start from nothing.
import { type ChildProcess, execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

import { siteConfig } from "../config/site.ts";

const repo = process.cwd();
const project = join(repo, ".cache", "install-test");
const REGISTRY_PORT = 4818;
const PREVIEW_PORT = 5191;
const namespace = siteConfig.registry.namespace;

type Item = { name: string; type: string; files?: { path: string; type: string }[] };

const run = (command: string, cwd = project) => execSync(command, { cwd, stdio: "inherit" });
const step = (text: string) => console.log(`\n== ${text}`);
const pascal = (name: string) =>
  name.replace(/(^|-)(\w)/g, (_, __, letter: string) => letter.toUpperCase());

function scaffold(): void {
  step("Scaffolding a Vite + React + Tailwind v4 + shadcn project");
  mkdirSync(join(repo, ".cache"), { recursive: true });
  run(
    "npx -y create-vite@latest install-test --template react-ts --no-interactive",
    join(repo, ".cache"),
  );
  run("npm install");
  run("npm install tailwindcss @tailwindcss/vite");
  run("npm install -D @types/node");
  for (const file of ["tsconfig.json", "tsconfig.app.json"]) {
    const path = join(project, file);
    const config = JSON.parse(readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""));
    config.compilerOptions = { ...config.compilerOptions, paths: { "@/*": ["./src/*"] } };
    writeFileSync(path, JSON.stringify(config, null, 2));
  }
  writeFileSync(
    join(project, "vite.config.ts"),
    [
      'import path from "node:path"',
      'import tailwindcss from "@tailwindcss/vite"',
      'import react from "@vitejs/plugin-react"',
      'import { defineConfig } from "vite"',
      "",
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      '  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },',
      "})",
      "",
    ].join("\n"),
  );
  writeFileSync(join(project, "src", "index.css"), '@import "tailwindcss";\n');
  run("npx -y shadcn@latest init -b base -p nova -y --no-monorepo");
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function answers(port: number): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}/`);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(port: number, until: number): Promise<void> {
  if (await answers(port)) return;
  if (Date.now() > until) throw new Error(`nothing answered on port ${port}`);
  await sleep(250);
  return waitFor(port, until);
}

/**
 * Starts a Node process and waits until it answers. Refuses a busy port: a server left over from
 * an earlier run would otherwise be tested instead of this one.
 */
async function startServer(args: string[], cwd: string, port: number): Promise<ChildProcess> {
  if (await answers(port)) throw new Error(`port ${port} is already in use; stop what is on it`);
  const child = spawn(process.execPath, args, { cwd, stdio: "ignore" });
  await waitFor(port, Date.now() + 30_000);
  return child;
}

function writeChecks(items: Item[]): void {
  const imports: string[] = [];
  const names: string[] = [];
  for (const item of items) {
    const name = pascal(item.name);
    if (item.type === "registry:ui") {
      imports.push(`import { ${name} } from "@/components/ui/${item.name}";`);
      names.push(name);
    } else if (item.type === "registry:block") {
      imports.push(`import { ${name} } from "@/components/${item.name}";`);
      names.push(name);
    } else {
      // Hooks and libraries: the module must exist at the documented path.
      for (const file of item.files ?? []) {
        const base = file.path
          .split("/")
          .pop()!
          .replace(/\.tsx?$/, "");
        const where =
          file.type === "registry:hook"
            ? `@/hooks/${base}`
            : file.path.includes("/boards/")
              ? `@/lib/boards/${base}`
              : `@/lib/${base}`;
        const alias = `m${imports.length}`;
        imports.push(`import * as ${alias} from "${where}";`);
        names.push(alias);
      }
    }
  }
  writeFileSync(
    join(project, "src", "benchcn-imports.ts"),
    `${imports.join("\n")}\n\nexport const everything = [${names.join(", ")}];\n`,
  );
  const blocks = items.filter((item) => item.type === "registry:block");
  writeFileSync(
    join(project, "src", "App.tsx"),
    [
      'import { everything } from "./benchcn-imports";',
      ...blocks.map((b) => `import { ${pascal(b.name)} } from "@/components/${b.name}";`),
      "",
      "export default function App() {",
      "  return (",
      `    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6" data-count={everything.length}>`,
      ...blocks.map((b) => `      <${pascal(b.name)} />`),
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
  );
}

async function render(blocks: Item[]): Promise<string[]> {
  // The dev server, not the production build: React only prints its warnings in development, and
  // the template's StrictMode double mount catches effects that do not clean up.
  const vite = join(project, "node_modules", "vite", "bin", "vite.js");
  const server = await startServer(
    [vite, "--port", String(PREVIEW_PORT), "--strictPort"],
    project,
    PREVIEW_PORT,
  );
  const browser = await chromium.launch();
  const problems: string[] = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        problems.push(`console ${message.type()}: ${message.text()}`);
      }
    });
    await page.goto(`http://localhost:${PREVIEW_PORT}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    const counts = await Promise.all(
      blocks.map((block) => page.locator(`[data-slot="${block.name}"]`).count()),
    );
    blocks.forEach((block, i) => {
      if (counts[i] === 0) problems.push(`block ${block.name} did not render`);
    });
  } finally {
    await browser.close();
    server.kill();
  }
  return problems;
}

async function main(): Promise<void> {
  const manifest = join(repo, "dist", "client", "r", "registry.json");
  if (!existsSync(manifest)) throw new Error("No built registry. Run `pnpm build` first.");
  const items: Item[] = JSON.parse(readFileSync(manifest, "utf8")).items;

  if (!existsSync(join(project, "components.json"))) scaffold();

  const components = JSON.parse(readFileSync(join(project, "components.json"), "utf8"));
  components.registries = {
    [namespace]: `http://localhost:${REGISTRY_PORT}${siteConfig.basepath}/r/{name}.json`,
  };
  writeFileSync(join(project, "components.json"), JSON.stringify(components, null, 2));

  step("Removing what the last run installed");
  for (const dir of ["src/components", "src/hooks"])
    rmSync(join(project, dir), { recursive: true, force: true });
  const lib = join(project, "src", "lib");
  for (const name of existsSync(lib) ? readdirSync(lib) : []) {
    if (name !== "utils.ts") rmSync(join(lib, name), { recursive: true, force: true });
  }

  const server = await startServer(
    ["scripts/serve-static.mts", String(REGISTRY_PORT)],
    repo,
    REGISTRY_PORT,
  );
  try {
    step(`Installing ${items.length} items`);
    run(
      `npx -y shadcn@latest add ${items.map((i) => `${namespace}/${i.name}`).join(" ")} -y --overwrite`,
    );
  } finally {
    server.kill();
  }

  step("Checking every documented import path, then typechecking and building");
  writeChecks(items);
  run("npx tsc -p tsconfig.app.json --noEmit");
  run("npx vite build");

  step("Rendering the blocks");
  const problems = await render(items.filter((i) => i.type === "registry:block"));
  if (problems.length > 0) {
    console.error(problems.map((p) => `  ${p}`).join("\n"));
    throw new Error(`${problems.length} problem(s) while rendering`);
  }
  console.log(
    `\ninstall test passed: ${items.length} items installed, typechecked, built and rendered`,
  );
}

main().catch((error: unknown) => {
  console.error(`\ninstall test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
