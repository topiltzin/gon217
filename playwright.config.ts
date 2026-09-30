import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  // Runs against a production build so tests see what Vercel will serve.
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: "mobile",
      grepInvert: /@webgl/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 740 }, hasTouch: true },
    },
    {
      name: "desktop",
      grepInvert: /@webgl/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // WebGL tests run alone after the rest: without a GPU, Chromium renders in
      // software, and sharing the CPU with other workers starves it.
      name: "webgl",
      grep: /@webgl/,
      dependencies: ["mobile", "desktop"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 800, height: 450 } },
    },
  ],
});
