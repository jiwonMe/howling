import { expect, test } from "@playwright/test";

const values = [800, 900, 1100, 1200, 1400];

test("builds a mean flow and turns on the HA helper once", async ({ page, request }) => {
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
  const flowId = /\/flows\/([0-9a-f-]+)/.exec(page.url())?.[1] ?? "";
  expect(flowId).toMatch(/^[0-9a-f-]{36}$/);

  await page.getByTestId("palette-core.input").click();
  await page.getByTestId("palette-analysis.rolling-mean").click();
  await page.getByTestId("palette-core.condition").click();
  await page.getByTestId("palette-core.effect").click();

  await page.getByTestId("trigger-entity").fill("input_number.test_power");
  await page.getByTestId("node-mean").click();
  await page.getByTestId("bind-window").fill("5");
  await page.getByTestId("bind-mean-path").fill("/power");
  await page.getByTestId("node-condition").click();
  await page.getByTestId("bind-right").fill("1000");
  await page.getByTestId("node-effect").click();
  await page.getByTestId("bind-domain").fill("input_boolean");
  await page.getByTestId("bind-service").fill("turn_on");
  await page.getByTestId("bind-entity").fill("input_boolean.test_alert");

  await page.getByTestId("save-draft").click();
  await page.getByTestId("validate-flow").click();
  await expect(page.getByText("검증 통과")).toBeVisible();
  await page.getByTestId("deploy-flow").click();
  await expect(page.locator("header")).toContainText("배포 active", { timeout: 60_000 });

  for (const value of values) {
    const before = await countRuns(page, flowId);
    const set = await request.post("http://ha-control:8090/set-power", {
      data: { value },
    });
    expect(set.ok()).toBeTruthy();
    await expect.poll(async () => countRuns(page, flowId), { timeout: 60_000 }).toBe(before + 1);
    await expect.poll(async () => latestStatus(page, flowId), { timeout: 60_000 }).toBe("completed");
    await page.waitForTimeout(500);
  }

  const hooks = await request.get("http://ha-control:8090/runtime-hooks");
  const hookBody = (await hooks.json()) as { haServiceCalls: number };
  expect(hookBody.haServiceCalls).toBe(1);

  const alert = await request.get("http://ha-control:8090/alert");
  expect((await alert.json() as { state: string }).state).toBe("on");

  const runs = await page.request.get(
    `https://howling.test/api/v1/sites/site_dev/runs?flowId=${flowId}`,
  );
  const body = (await runs.json()) as {
    runs: { runId: string; revisionId: string; status: string }[];
  };
  const last = body.runs[0];
  expect(last?.status).toBe("completed");
  await page.goto(`/runs/${last?.runId ?? ""}`);
  await expect(page.getByTestId("run-id")).toHaveText(last?.runId ?? "");
  await expect(page.getByTestId("run-revision")).toContainText(last?.revisionId ?? "");
  await expect.poll(async () => {
    const events = await page.request.get(
      `https://howling.test/api/v1/sites/site_dev/runs/${last?.runId ?? ""}/events?after=0`,
    );
    const payload = (await events.json()) as { events: { sequence: number }[] };
    return payload.events.length;
  }).toBeGreaterThan(0);
});

const runsUrl = (flowId: string) =>
  `https://howling.test/api/v1/sites/site_dev/runs?flowId=${flowId}`;

const countRuns = async (
  page: { request: { get: (url: string) => Promise<{ json: () => Promise<unknown> }> } },
  flowId: string,
) => {
  const response = await page.request.get(runsUrl(flowId));
  const body = (await response.json()) as { runs: { status: string }[] };
  return body.runs.length;
};

const latestStatus = async (
  page: { request: { get: (url: string) => Promise<{ json: () => Promise<unknown> }> } },
  flowId: string,
) => {
  const response = await page.request.get(runsUrl(flowId));
  const body = (await response.json()) as { runs: { status: string }[] };
  return body.runs[0]?.status;
};
