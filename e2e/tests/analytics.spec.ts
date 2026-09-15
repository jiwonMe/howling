import { expect, test } from "@playwright/test";

test("shows analytics widgets and capture-raw controls", async ({ page }) => {
  await expect.poll(async () => (await page.request.get("/health")).ok()).toBeTruthy();
  await page.goto("/");
  await page.locator('input[name="email"]').fill("owner@howling.test");
  await page.locator('input[name="password"]').fill("howling-dev");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "Howling" })).toBeVisible();

  await page.getByRole("link", { name: "관측" }).click();
  await expect(page.getByRole("heading", { name: "관측" })).toBeVisible();
  await expect(page.getByTestId("chart-series")).toBeVisible();
  await expect(page.getByTestId("chart-success")).toBeVisible();
  await expect(page.getByTestId("chart-nodes")).toBeVisible();
  await expect(page.getByTestId("chart-errors")).toBeVisible();
  await page.getByTestId("obs-flow").fill("power-alert");
  await page.getByTestId("save-observation").click();
  await expect(page.getByText("관측 필드를 저장했습니다.")).toBeVisible();

  await page.getByRole("link", { name: "연결" }).click();
  await expect(page.getByTestId("capture-raw")).toBeVisible();
  await expect(page.getByTestId("oauth-preset")).toBeVisible();
  await page.getByTestId("oauth-preset").selectOption("github");
  await expect(page.getByTestId("oauth-authorize")).toHaveValue(
    "https://github.com/login/oauth/authorize",
  );
});
