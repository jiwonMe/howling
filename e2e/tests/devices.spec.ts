import { expect, test } from "@playwright/test";

test("lists hub devices without entity ids", async ({ page, request }) => {
  await expect.poll(async () => (await page.request.get("/health")).ok()).toBeTruthy();
  await page.goto("/");
  await page.locator('input[name="email"]').fill("owner@howling.test");
  await page.locator('input[name="password"]').fill("howling-dev");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "Howling" })).toBeVisible();

  await request.post("http://runtime:4000/v1/setup/pair");
  const setup = await request.get("http://runtime:4000/v1/setup/status");
  const pairing = (await setup.json()) as { pairing: { code?: string } };
  expect(pairing.pairing.code).toBeTruthy();

  await page.getByRole("link", { name: "연결" }).click();
  await page.locator("#pair-code").fill(pairing.pairing.code ?? "");
  await page.getByRole("button", { name: "연결" }).click();
  await expect(page.getByTestId("runtime-online")).toHaveText("online", { timeout: 60_000 });
  await expect(page.getByTestId("ha-status")).toHaveText("ready", { timeout: 60_000 });

  await page.getByRole("link", { name: "기기" }).click();
  await expect(page).toHaveURL(/\/devices/);
  await expect(page.getByText("Test Power")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Test Alert")).toBeVisible();
  await expect(page.getByTestId("device-connect")).toBeVisible();
  await expect(page.getByRole("heading", { name: "기기 연결" })).toBeVisible();
  await expect(page.getByTestId("device-connect-catalog")).toBeVisible();
  await expect(page.getByTestId("device-connect-virtual")).toBeVisible();
  await expect(page.getByTestId("device-connect-apple_tv")).toBeVisible();
  await expect(page.getByRole("heading", { name: "기기 추가" })).toHaveCount(0);
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("input_number.");
  expect(body).not.toContain("input_boolean.");

  const listed = await page.request.get("https://howling.test/api/v1/sites/site_dev/devices");
  const payload = JSON.stringify(await listed.json());
  expect(payload).toContain("Test Power");
  expect(payload).toContain("Test Alert");
  expect(payload).not.toContain("input_number.");
  expect(payload).not.toContain("input_boolean.");
  expect(payload).not.toContain("entityId");

  await page.getByTestId("device-connect-virtual").click();
  await page.getByTestId("device-name").fill("E2E Extra Switch");
  await page.getByTestId("device-kind").selectOption("boolean");
  await page.getByTestId("device-add").click();
  await expect(page.getByTestId("device-list")).toContainText("E2E Extra Switch", { timeout: 60_000 });
  const after = await page.locator("body").innerText();
  expect(after).not.toContain("input_boolean.");
});
