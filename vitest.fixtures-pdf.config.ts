import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/texFixturesPdf.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
