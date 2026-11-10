import { expect, test } from "@playwright/test";

const COMPONENTS = [
  "oscilloscope",
  "logic-analyzer",
  "actuator-control",
  "emergency-stop",
  "joystick",
  "setpoint-input",
  "sensor-tile",
  "range-bar",
  "meter-readout",
  "alarm-list",
  "strip-chart",
  "status-led",
  "seven-segment",
  "character-lcd",
  "serial-console",
  "pinout-header",
  "bitfield-diagram",
  "timing-diagram",
];

test.describe("component pages", () => {
  for (const name of COMPONENTS) {
    test(`renders the ${name} page with a live preview`, async ({ page }) => {
      // #when
      const response = await page.goto(`./docs/components/${name}`);

      // #then the page exists and the demo mounted inside the preview tab
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("tab", { name: "Preview" })).toBeVisible();
      await expect(page.locator("[data-slot]").first()).toBeVisible();
    });
  }

  test("ships every component in the registry index", async ({ request }) => {
    // #when
    const index = await request.get("./r/registry.json");
    const json = (await index.json()) as { items: { name: string }[] };

    // #then
    const names = json.items.map((i) => i.name);
    expect(COMPONENTS.filter((c) => !names.includes(c))).toEqual([]);
  });

  test("serves a built registry item with its files", async ({ request }) => {
    // #when
    const item = await request.get("./r/oscilloscope.json");
    const json = (await item.json()) as { files: { path: string; content: string }[] };

    // #then the component source is embedded and starts with the benchcn header
    expect(json.files.some((f) => f.content.startsWith("// benchcn.dev"))).toBe(true);
  });

  test("lists component pages in llms.txt", async ({ request }) => {
    // #when
    const text = await (await request.get("./llms.txt")).text();

    // #then
    expect(text).toContain("/docs/components/oscilloscope");
  });
});
