/**
 * 테스트 OIDC issuer 진입점.
 */
import { createOidcApp } from "./app.js";
import { loadOidcConfig } from "./config.js";

const config = loadOidcConfig();
const app = await createOidcApp(config);
await app.listen({ host: config.listenHost, port: config.listenPort });
app.log.info(`oidc listening on ${config.issuer}`);
