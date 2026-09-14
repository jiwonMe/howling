/**
 * pnpm 10은 better-sqlite3 postinstall을 막으므로 바인딩을 직접 만든다.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("better-sqlite3/package.json"));
const result = spawnSync("npm", ["run", "install"], {
  cwd: pkg,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
