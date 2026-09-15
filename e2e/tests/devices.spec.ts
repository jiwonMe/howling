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

  await page.getByRole("link", { name: "상태" }).click();
  await expect(page.getByTestId("device-group-ha")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "집 기기" })).toBeVisible();
  await expect(page.getByTestId("device-dashboard")).toContainText("Test Power", { timeout: 60_000 });
  await expect(page.getByTestId("device-dashboard")).toContainText("Test Alert");
  await expect(page.getByTestId("device-dashboard")).toContainText("집");
  const home = await page.locator("body").innerText();
  expect(home).not.toContain("input_number.");
  expect(home).not.toContain("input_boolean.");
  await page.getByTestId("device-dashboard").getByRole("button", { name: /Test Alert/ }).click();
  await expect(page.getByTestId("device-dialog")).toBeVisible();
  await expect(page.getByTestId("device-dialog")).toContainText("집");
  await page.getByTestId("device-act-turn_off").click();
  await expect(page.getByTestId("device-dialog")).toContainText("꺼짐", { timeout: 20_000 });
  const dialog = await page.getByTestId("device-dialog").innerText();
  expect(dialog).not.toContain("input_boolean.");
  await page.getByTestId("device-dialog-close").click();

  await page.getByRole("link", { name: "기기" }).click();
  await expect(page).toHaveURL(/\/devices/);
  await expect(page.getByText("Test Power")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Test Alert")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "구분" })).toBeVisible();
  await expect(page.getByTestId("device-row").filter({ hasText: "Test Alert" })).toHaveAttribute(
    "data-origin",
    "ha",
  );
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
  expect(payload).toContain('"origin":"ha"');

  await page.getByTestId("device-connect-virtual").click();
  await page.getByTestId("device-name").fill("E2E Extra Switch");
  await page.getByTestId("device-kind").selectOption("boolean");
  await page.getByTestId("device-add").click();
  await expect(page.getByTestId("device-list")).toContainText("E2E Extra Switch", { timeout: 60_000 });
  await expect(page.getByTestId("device-row").filter({ hasText: "E2E Extra Switch" })).toHaveAttribute(
    "data-origin",
    "ha",
  );
  const extra = page.getByTestId("device-row").filter({ hasText: "E2E Extra Switch" });
  await extra.getByTestId("device-edit-open").click();
  await extra.getByTestId("device-edit-name").fill("E2E Extra Switch Renamed");
  await extra.getByTestId("device-edit-save").click();
  await expect(page.getByTestId("device-list")).toContainText("E2E Extra Switch Renamed", {
    timeout: 20_000,
  });
  const extraRenamed = page.getByTestId("device-row").filter({ hasText: "E2E Extra Switch Renamed" });
  await extraRenamed.getByTestId("device-delete-open").click();
  await extraRenamed.getByTestId("device-delete-confirm").click();
  await expect(page.getByTestId("device-list")).not.toContainText("E2E Extra Switch Renamed", {
    timeout: 20_000,
  });
  const afterForm = await page.locator("body").innerText();
  expect(afterForm).not.toContain("input_boolean.");

  await page.getByTestId("device-connect-virtual").click();
  await page.getByTestId("device-create-yaml-open").click();
  await page.getByTestId("device-yaml").fill("- name: E2E Yaml Switch\n  kind: boolean\n");
  await page.getByTestId("device-add-yaml").click();
  await expect(page.getByTestId("device-list")).toContainText("E2E Yaml Switch", { timeout: 60_000 });
  const afterYaml = await page.locator("body").innerText();
  expect(afterYaml).not.toContain("input_boolean.");
  expect(afterYaml).not.toContain("input_number.");

  await page.getByTestId("device-connect-virtual").click();
  await page.getByTestId("device-create-yaml-open").click();
  await page.getByTestId("device-yaml").fill("- name: E2E Living TV\n  product: Apple TV\n");
  await page.getByTestId("device-add-yaml").click();
  await expect(page.getByTestId("device-list")).toContainText("E2E Living TV", { timeout: 60_000 });
  await expect(page.getByTestId("device-list")).toContainText("E2E Living TV 리모컨");
  await expect(page.getByTestId("device-list")).toContainText("E2E Living TV 키보드");
  await expect(
    page
      .getByTestId("device-row")
      .filter({ hasText: "E2E Living TV" })
      .filter({ hasNotText: "리모컨" })
      .filter({ hasNotText: "키보드" }),
  ).toHaveAttribute("data-origin", "virtual");
  await expect(page.getByTestId("device-row").filter({ hasText: "E2E Living TV 리모컨" })).toHaveAttribute(
    "data-origin",
    "virtual",
  );
  const living = page
    .getByTestId("device-row")
    .filter({ hasText: "E2E Living TV" })
    .filter({ hasNotText: "리모컨" })
    .filter({ hasNotText: "키보드" });
  await living.getByTestId("device-edit-open").click();
  await living.getByTestId("device-edit-name").fill("E2E Living TV Renamed");
  await living.getByTestId("device-edit-save").click();
  await expect(page.getByTestId("device-list")).toContainText("E2E Living TV Renamed", { timeout: 20_000 });
  const livingRenamed = page.getByTestId("device-row").filter({ hasText: "E2E Living TV Renamed" });
  await livingRenamed.getByTestId("device-delete-open").click();
  await livingRenamed.getByTestId("device-delete-confirm").click();
  await expect(page.getByTestId("device-list")).not.toContainText("E2E Living TV Renamed", {
    timeout: 20_000,
  });
  await expect(page.getByTestId("device-list")).toContainText("E2E Living TV 리모컨");
  const afterProduct = await page.locator("body").innerText();
  expect(afterProduct).not.toContain("input_boolean.");
  expect(afterProduct).not.toContain("media_player.");
  expect(afterProduct).not.toContain("remote.");

  await page.getByRole("link", { name: "상태" }).click();
  await expect(page.getByTestId("device-group-ha")).toContainText("E2E Yaml Switch");
  await expect(page.getByTestId("device-group-virtual")).toContainText("E2E Living TV 리모컨");
  await expect(page.getByTestId("device-group-ha")).not.toContainText("E2E Living TV");
  await page
    .getByTestId("device-dashboard-virtual")
    .locator('[data-testid="device-tile"]')
    .filter({ hasText: "E2E Living TV 리모컨" })
    .click();
  await expect(page.getByTestId("device-dialog")).toContainText("가상");
  await expect(page.getByTestId("device-dialog")).toContainText("플로 시험용입니다.");
});
