import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("shows the live bench with a triggered scope", async ({ page }) => {
    // #when
    await page.goto("./");

    // #then the hero bench mounted and the scope found its trigger
    await expect(page.locator("[data-slot=bench]")).toBeVisible();
    await expect(page.locator("[data-slot=scope-status]")).toContainText(/Trig|Auto/);
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
