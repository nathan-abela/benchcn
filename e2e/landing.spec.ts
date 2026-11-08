import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("shows the live bench with a triggered scope and a decoded bus", async ({ page }) => {
    // #when
    await page.goto("./");

    // #then the bench mounted, the scope found its trigger and the analyzer decoded the I2C read
    await expect(page.locator("[data-slot=bench]")).toBeVisible();
    await expect(page.locator("[data-slot=scope-status]").first()).toContainText(/Trig|Auto/);
    await expect(page.locator("[data-slot=bench]")).toContainText("0x76");
  });

  test("loads without page errors", async ({ page }) => {
    // #given
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // #when
    await page.goto("./");
    await page.waitForLoadState("networkidle");

    // #then
    expect(errors).toEqual([]);
  });

  test("shows every section once it scrolls into view", async ({ page }) => {
    // #given
    await page.goto("./");
    const sections = ["scenarios", "how", "components", "agents"];

    // #when each section is scrolled to, which runs its entrance animation
    const visible: string[] = [];
    for (const id of sections) {
      const section = page.locator(`#${id}`);
      await section.scrollIntoViewIfNeeded();
      await expect(section.getByRole("heading", { level: 2 })).toBeVisible();
      visible.push(id);
    }

    // #then
    expect(visible).toEqual(sections);
  });

  test("prerenders the default scenario instead of streaming it late", async ({ request }) => {
    // #when
    const html = await (await request.get("./")).text();

    // #then the plant monitor is in the HTML and no streamed boundary scripts are needed
    expect({
      block: html.includes('data-slot="plant-monitor"'),
      streamed: /\$R[SC]\(/.test(html),
    }).toEqual({ block: true, streamed: false });
  });

  test("switches the theme and remembers it", async ({ page }) => {
    // #given
    await page.goto("./");

    // #when the Blue chip is pressed and the page reloads
    await page.getByRole("button", { name: "Blue" }).click();
    await page.reload();

    // #then
    await expect(page.locator("html")).toHaveAttribute("data-theme", "blue");
  });

  test("switches scenarios", async ({ page }) => {
    // #given
    await page.goto("./");

    // #when
    await page.getByRole("tab", { name: "Weather station" }).click();

    // #then
    await expect(page.locator("[data-slot=weather-station]")).toBeVisible();
  });

  test("renders a block in kiosk layout at 800 by 480", async ({ page }) => {
    // #given
    await page.setViewportSize({ width: 800, height: 480 });

    // #when
    await page.goto("./kiosk/plant-monitor");

    // #then nothing scrolls
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollHeight > document.documentElement.clientHeight ||
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
