import { defineConfig, devices } from "@playwright/test";

import { siteConfig } from "./config/site";

const port = 4817;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}${siteConfig.basepath}/`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node scripts/serve-static.mts ${port}`,
    url: `http://localhost:${port}${siteConfig.basepath}/`,
    reuseExistingServer: !process.env.CI,
  },
});
