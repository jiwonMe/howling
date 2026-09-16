/**
 * 배포에서 웹 번들을 API와 같은 origin으로 낸다. WEB_DIST가 없으면 아무것도 하지 않는다.
 * /api·/mcp·/health·/ready 밖의 GET은 SPA index.html로 떨어진다.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const isApiPath = (path: string): boolean =>
  path.startsWith("/api/") ||
  path === "/mcp" ||
  path.startsWith("/mcp/") ||
  path === "/health" ||
  path === "/ready";

export const registerWebStatic = async (
  app: FastifyInstance,
  webDist: string | undefined,
): Promise<void> => {
  if (!webDist) {
    return;
  }
  const root = resolve(webDist);
  if (!existsSync(resolve(root, "index.html"))) {
    throw new Error(`WEB_DIST에 index.html이 없습니다: ${root}`);
  }
  await app.register(fastifyStatic, {
    root,
    wildcard: false,
    index: ["index.html"],
    cacheControl: true,
    maxAge: "1h",
    immutable: false,
  });
  app.setNotFoundHandler(async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (request.method !== "GET" || isApiPath(path)) {
      return reply.code(404).send({ error: { code: "not_found", message: "not found" } });
    }
    return reply.header("cache-control", "no-cache").sendFile("index.html");
  });
};
