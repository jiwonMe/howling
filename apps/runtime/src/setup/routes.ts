/**
 * 로컬 HA·pairing setup.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { readSecret, writeSecret } from "../secrets/store.js";
import { setupHtml } from "./html.js";
import { requestPairing, type PairingDeps, type PairingState } from "./pairing.js";

const brandCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "assets/vercel-brand.css"),
  "utf8",
);

export const registerSetupRoutes = (
  app: FastifyInstance,
  input: {
    readonly secretRoot: string;
    readonly pairing: PairingState;
    readonly pairingDeps: PairingDeps;
    readonly onHaSaved: () => void;
  },
): void => {
  app.get("/setup", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(setupHtml());
  });

  app.get("/setup/vercel-brand.css", async (_request, reply) => {
    return reply.type("text/css; charset=utf-8").send(brandCss);
  });

  app.get("/v1/setup/status", async () => ({
    haConfigured: Boolean(readSecret(input.secretRoot, "ha-token")),
    pairing: pairingViewOf(input.pairing.snapshot(), input.secretRoot),
  }));

  app.post("/v1/setup/ha", async (request, reply) => {
    const body = request.body as { url?: string; token?: string };
    if (!body.url || !body.token) {
      return reply.code(400).send({ error: "url and token required" });
    }
    writeSecret(input.secretRoot, "ha-url", body.url);
    writeSecret(input.secretRoot, "ha-token", body.token);
    input.onHaSaved();
    return { ok: true };
  });

  app.post("/v1/setup/pair", async () => {
    await requestPairing(input.pairingDeps, input.pairing);
    return pairingViewOf(input.pairing.snapshot(), input.secretRoot);
  });
};

const pairingViewOf = (
  pairing: ReturnType<PairingState["snapshot"]>,
  secretRoot: string,
): ReturnType<PairingState["snapshot"]> => {
  if (pairing.status === "idle" && readSecret(secretRoot, "runtime-token")) {
    return { status: "ready" };
  }
  return pairing;
};
