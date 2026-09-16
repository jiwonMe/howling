import { expect, test } from "@playwright/test";

test("tests a mean flow without calling Home Assistant", async ({ page, request }) => {
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

  await page.goto("/flows");
  await page.getByTestId("create-flow").click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await expect(page).toHaveURL(/\/flows\/[0-9a-f-]{36}/);

  await page.getByTestId("palette-core.input").click();
  await page.getByTestId("palette-analysis.rolling-mean").click();
  await page.getByTestId("palette-core.condition").click();
  await page.getByTestId("palette-core.effect").click();
  await page.getByTestId("flow-settings").click();
  await expect
    .poll(async () => page.getByTestId("trigger-device").locator("option", { hasText: "Test Power" }).count(), {
      timeout: 60_000,
    })
    .toBeGreaterThan(0);
  await page.getByTestId("trigger-device").selectOption({ label: "Test Power" });
  await page.getByTestId("node-mean").click();
  await page.getByTestId("bind-window").fill("5");
  await page.getByTestId("bind-mean-path").fill("/power");
  await page.getByTestId("node-condition").click();
  await page.getByTestId("bind-right").fill("1000");
  await page.getByTestId("node-effect").click();
  await expect
    .poll(async () => page.getByTestId("bind-device").locator("option", { hasText: "Test Alert" }).count(), {
      timeout: 60_000,
    })
    .toBeGreaterThan(0);
  await page.getByTestId("bind-device").selectOption({ label: "Test Alert" });
  await page.getByTestId("bind-action").selectOption("turn_on");
  await page.getByTestId("save-draft").click();
  await page.getByTestId("validate-flow").click();
  await expect(page.getByText("검증 통과")).toBeVisible();

  const beforeHooks = await request.get("http://ha-control:8090/runtime-hooks");
  const beforeCalls = ((await beforeHooks.json()) as { haServiceCalls: number }).haServiceCalls;

  await page.getByTestId("dry-run-flow").click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByTestId("dry-run-badge")).toHaveText("시험");
  const runId = /\/runs\/([0-9a-f-]+)/.exec(page.url())?.[1] ?? "";
  await expect
    .poll(async () => {
      const view = await request.get(`http://runtime:4000/v1/runs/${runId}`);
      const body = (await view.json()) as {
        status?: string;
        outbox?: { effectId: string; status: string }[];
      };
      if (body.status === "completed") {
        return body.status;
      }
      const effect = body.outbox?.find((item) => item.status === "requested");
      if (effect) {
        await request.post(`http://runtime:4000/v1/runs/${runId}/commands`, {
          headers: { "content-type": "application/json" },
          data: {
            type: "fixture",
            commandId: `e2e-${Date.now()}`,
            effectId: effect.effectId,
            response: { source: "fixture", status: "succeeded", value: { ok: true } },
          },
        });
      }
      await request.post(`http://runtime:4000/v1/runs/${runId}/commands`, {
        headers: { "content-type": "application/json" },
        data: { type: "continue", commandId: `e2e-go-${Date.now()}` },
      });
      const again = await request.get(`http://runtime:4000/v1/runs/${runId}`);
      return ((await again.json()) as { status?: string }).status;
    }, { timeout: 90_000 })
    .toBe("completed");
  await expect
    .poll(async () => {
      const cloud = await page.request.get(
        `https://howling.test/api/v1/sites/site_dev/runs/${runId}`,
      );
      return ((await cloud.json()) as { status?: string }).status;
    }, { timeout: 60_000 })
    .toBe("completed");
  await expect.poll(async () => page.getByTestId("run-status").innerText()).toBe("completed");

  const afterDry = await request.get("http://ha-control:8090/runtime-hooks");
  expect(((await afterDry.json()) as { haServiceCalls: number }).haServiceCalls).toBe(beforeCalls);
  const alert = await request.get("http://ha-control:8090/alert");
  expect(((await alert.json()) as { state: string }).state).toBe("off");
});
