import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "https://howling.test",
    ignoreHTTPSErrors: false,
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: {
      args: [
        "--use-system-ca-store",
        "--disable-features=ChromeRootStoreUsed",
      ],
    },
  },
});
