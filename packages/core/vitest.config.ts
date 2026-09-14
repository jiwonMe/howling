/** Node 환경 Vitest. 브라우저 smoke는 HTTP harness로 따로 연다. */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
