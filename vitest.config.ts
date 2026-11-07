import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["registry/**/*.test.ts", "src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    tsconfigPaths: true,
  },
});
