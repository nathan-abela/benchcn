import { expect, test } from "@playwright/test";

test.describe("static site", () => {
  test("serves the landing page", async ({ page }) => {
    // #given the prerendered site is served at the basepath
    // #when the root loads
    const response = await page.goto("./");

    // #then the page is found and shows the tagline
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hardware UI");
  });

  test("serves a docs page with navigation", async ({ page }) => {
    await page.goto("./docs");

    await expect(page.getByRole("heading", { name: "Introduction" })).toBeVisible();
  });

  test("ships the registry index and an item", async ({ request }) => {
    // #when fetching the registry index
    const index = await request.get("./r/registry.json");

    // #then it lists the tokens item
    expect(index.ok()).toBe(true);
    const json = (await index.json()) as { items: { name: string }[] };
    expect(json.items.map((i) => i.name)).toContain("tokens");
  });

  test("ships llms.txt", async ({ request }) => {
    const response = await request.get("./llms.txt");

    expect(response.ok()).toBe(true);
  });

  test("serves the 404 page for unknown routes", async ({ page }) => {
    const response = await page.goto("./definitely-not-a-page");

    expect(response?.status()).toBe(404);
  });

  test("renders the docs page in dark mode without horizontal overflow at phone width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("./docs/wire-protocol");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
