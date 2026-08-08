import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [
      "tests/integration/texFixturesCompile.test.ts",
      "tests/integration/texFixturesPdf.test.ts",
    ],
    setupFiles: ["tests/setup.ts"],
  },
});
