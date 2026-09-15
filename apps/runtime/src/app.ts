/**
 * 로컬 health·run·setup HTTP 서버.
 */
import Fastify, { type FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import type { RuntimeHost } from "./coordinator/host.js";
import type { GatewayHandle } from "./gateway/client.js";
import type { HaCallLog } from "./ha/hooks.js";
import { registerHealthRoutes } from "./health/routes.js";
import { registerHookRoutes } from "./http/hooks.js";
import { registerRunRoutes } from "./http/run-routes.js";
import { registerSetupRoutes } from "./setup/routes.js";
import type { PairingDeps, PairingState } from "./setup/pairing.js";
import type { McpRegistry } from "./mcp/registry.js";
import { registerMcpSetupRoutes } from "./mcp/setup.js";
import type { AdapterCall } from "./effects/fake-adapter.js";

export const createRuntimeApp = (
  db: Database.Database,
  host?: RuntimeHost,
  extras?: {
    readonly secretRoot?: string;
    readonly pairing?: PairingState;
    readonly pairingDeps?: PairingDeps;
    readonly onHaSaved?: () => void;
    readonly hooks?: HaCallLog;
    readonly gateway?: GatewayHandle;
    readonly mcp?: {
      readonly registry: McpRegistry;
      readonly siteId: () => string;
      readonly apiHttpUrl: string;
      readonly onChanged: () => void;
    };
    readonly adapterCalls?: AdapterCall[];
  },
): FastifyInstance => {
  const app = Fastify({ logger: false });
  registerHealthRoutes(app, db);
  if (host) {
    registerRunRoutes(app, host);
  }
  if (extras?.secretRoot && extras.pairing && extras.pairingDeps && extras.onHaSaved) {
    registerSetupRoutes(app, {
      secretRoot: extras.secretRoot,
      pairing: extras.pairing,
      pairingDeps: extras.pairingDeps,
      onHaSaved: extras.onHaSaved,
    });
  }
  if (extras?.secretRoot && extras.mcp) {
    registerMcpSetupRoutes(app, {
      db,
      secretRoot: extras.secretRoot,
      siteId: extras.mcp.siteId,
      apiHttpUrl: extras.mcp.apiHttpUrl,
      registry: extras.mcp.registry,
      onChanged: extras.mcp.onChanged,
    });
  }
  if (extras?.hooks) {
    registerHookRoutes(app, extras.hooks, extras.gateway, extras.adapterCalls);
  }
  return app;
};
