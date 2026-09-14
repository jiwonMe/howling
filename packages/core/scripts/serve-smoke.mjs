/**
 * 브라우저 smoke용 정적 서버.
 * file:// 은 ES 모듈을 서로 다른 origin으로 막아 HTTP로만 연다.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.HOWLING_SMOKE_PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const insideRoot = (path) => {
  const resolved = resolve(path);
  return resolved === root || resolved.startsWith(`${root}/`);
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const relative = url.pathname === "/" ? "/examples/browser-smoke.html" : url.pathname;
  const filePath = normalize(join(root, decodeURIComponent(relative)));
  if (!insideRoot(filePath)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": types[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Howling browser smoke: http://127.0.0.1:${port}/examples/browser-smoke.html\n`,
  );
});
