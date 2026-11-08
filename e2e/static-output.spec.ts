import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { expect, test } from "@playwright/test";

const OUTPUT = join(process.cwd(), "dist", "client");

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

test.describe("static output", () => {
  test("ends every prerendered page with a single closing html tag", () => {
    // #given every HTML file the prerender wrote
    const files = htmlFiles(OUTPUT);

    // #when looking for streamed chunks that landed after </html>
    const broken = files
      .filter((file) => {
        const html = readFileSync(file, "utf8");
        return html.split("</html>").length !== 2 || !html.trimEnd().endsWith("</html>");
      })
      .map((file) => relative(OUTPUT, file));

    // #then none did; a lazy component suspending in the first render is the usual cause
    expect({ checked: files.length > 0, broken }).toEqual({ checked: true, broken: [] });
  });
});
