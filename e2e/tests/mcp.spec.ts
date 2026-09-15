import { expect, test } from "@playwright/test";

test("deploys an echo MCP flow once and keeps dry-run off the wire", async ({ page, request }) => {
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

  const saved = await request.post("http://runtime:4000/v1/setup/mcp", {
    data: {
      id: "echo",
      name: "Echo",
      transport: "http",
      url: "http://mcp:8091/mcp",
      auth: "bearer",
      token: "test-mcp-token",
    },
  });
  expect(saved.ok()).toBeTruthy();
  await expect(page.getByTestId("mcp-status")).toHaveText("ready", { timeout: 60_000 });

  await request.post("http://mcp:8091/hooks/reset");
  const before = await request.get("http://mcp:8091/hooks");
  const beforeCalls = ((await before.json()) as { mcpCalls: number }).mcpCalls;

  await page.goto("/flows");
  await page.getByTestId("create-flow").click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await page.getByTestId("palette-core.input").click();
  await page.getByTestId("palette-core.effect").click();
  await page.getByTestId("node-effect").click();
  await page.getByTestId("bind-adapter").selectOption("mcp");
  await page.getByTestId("bind-mcp-connection").selectOption("echo");
  await page.getByTestId("bind-mcp-tool").selectOption("echo");
  await page.getByTestId("bind-mcp-args").fill('{"text":"ping"}');
  await page.getByTestId("save-draft").click();
  await page.getByTestId("validate-flow").click();
  await expect(page.getByText("검증 통과")).toBeVisible();
  await page.getByTestId("deploy-flow").click();
  await expect(page.locator("header")).toContainText("배포 active", { timeout: 60_000 });

  await page.getByTestId("live-run-flow").click();
  await expect
    .poll(async () => {
      const hooks = await request.get("http://mcp:8091/hooks");
      return ((await hooks.json()) as { mcpCalls: number }).mcpCalls;
    }, { timeout: 60_000 })
    .toBe(beforeCalls + 1);

  await page.getByTestId("dry-run-flow").click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByTestId("dry-run-badge")).toHaveText("시험");
  const afterDry = await request.get("http://mcp:8091/hooks");
  expect(((await afterDry.json()) as { mcpCalls: number }).mcpCalls).toBe(beforeCalls + 1);
});
