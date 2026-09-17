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
    // 요소를 못 찾으면 전체 timeout까지 기다리지 말고 어느 locator인지 바로 알린다.
    actionTimeout: 60_000,
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
