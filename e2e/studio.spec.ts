import { expect, test } from "@playwright/test";

test.describe("studio", () => {
  test("prerenders the starter dashboard", async ({ request }) => {
    // #when the static HTML is fetched without running any script
    const response = await request.get("./studio");
    const html = await response.text();

    // #then the starter layout is already in the page
    expect(response.ok()).toBe(true);
    expect(html).toContain("Air temperature");
    expect(html).toContain("Water pump");
  });

  test("adds a component and exports it with one install command", async ({ page }) => {
    // #given
    await page.goto("./studio");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    // #when a battery indicator is added and the code view opened
    await page.getByRole("button", { name: "Battery indicator" }).click();
    await page.getByRole("button", { name: "Code", exact: true }).click();

    // #then the file uses it and the command installs it
    await expect(page.getByText("BatteryIndicator").first()).toBeVisible();
    await expect(
      page.getByText(/shadcn@latest add .*@benchcn\/battery-indicator/).first(),
    ).toBeVisible();
  });

  test("reopens a shared layout from the link", async ({ page }) => {
    // #given a layout shared from another browser
    await page.goto("./studio");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Serial console" }).click();
    const link = await page.evaluate(async () => {
      let copied = "";
      navigator.clipboard.writeText = async (text: string) => {
        copied = text;
      };
      document.querySelector<HTMLButtonElement>('button[aria-label="Copy share link"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return copied;
    });
    await page.evaluate(() => window.localStorage.clear());

    // #when the link is opened fresh
    await page.goto(link);

    // #then the shared layout is on the canvas
    await expect(page.getByText("Shared layout")).toBeVisible();
    await expect(page.locator('[data-widget] [data-slot="serial-console"]')).toBeVisible();
  });
});
