/**
 * 로컬 HA·pairing setup.
 */
import type { FastifyInstance } from "fastify";
import { readSecret, writeSecret } from "../secrets/store.js";
import { setupHtml } from "./html.js";
import { requestPairing, type PairingDeps, type PairingState } from "./pairing.js";

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
    return reply.type("text/html").send(setupHtml());
  });

  app.get("/v1/setup/status", async () => ({
    haConfigured: Boolean(readSecret(input.secretRoot, "ha-token")),
    pairing: input.pairing.snapshot(),
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
    return input.pairing.snapshot();
  });
};
