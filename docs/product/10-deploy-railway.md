# Railway 배포

클라우드는 Railway 한 프로젝트(`howling`)에 세 서비스로 올린다. runtime은 집(HA OS 앱·Docker)에서 돌고 pairing으로 붙는다.

| 서비스 | 소스 | 도메인 | 역할 |
| --- | --- | --- | --- |
| `api` | `infra/railway/Dockerfile.api` | `app.howling.life` | API + 웹 번들(같은 origin) + runtime WebSocket + MCP |
| `oidc` | `infra/railway/Dockerfile.oidc` | `auth.howling.life` | 한 계정 OIDC issuer(`infra/oidc`) |
| `Postgres` | Railway 템플릿 | 비공개 | `${{Postgres.DATABASE_URL}}` |

GitHub `jiwonMe/howling`의 `main`에 push하면 watch pattern에 맞는 서비스만 다시 빌드된다.

## 웹을 API가 내는 이유

배포에서는 nginx 없이 `WEB_DIST`가 가리키는 `apps/web/dist`를 `@fastify/static`으로 낸다. `/api/*`, `/mcp`, `/health`, `/ready` 밖의 GET은 `index.html`로 떨어져 SPA 라우팅이 된다. 로컬 개발(`pnpm dev`)에서는 `WEB_DIST`가 비어 있어 예전처럼 Vite가 낸다.

한 origin이라 세션 cookie·CSRF·WebSocket이 그대로 동작한다. `credentials: "same-origin"`을 쓰는 웹 코드도 손대지 않았다.

## 변수

`api`

| 키 | 값 |
| --- | --- |
| `PORT`, `API_HOST` | `3000`, `0.0.0.0` |
| `WEB_DIST` | `/app/web` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `PUBLIC_ORIGIN` | `https://app.howling.life` |
| `OIDC_ISSUER` | `https://auth.howling.life` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | `howling-web` / sealed |
| `OIDC_REDIRECT_URI` | `https://app.howling.life/api/v1/auth/callback` |
| `COOKIE_SECURE` | `true` |
| `BOOTSTRAP_SITE_ID` / `BOOTSTRAP_SITE_NAME` | `site_home` / `Home` |
| `BOOTSTRAP_RUNTIME_TOKEN` | 비움. runtime은 pairing으로 붙는다 |

`oidc`

| 키 | 값 |
| --- | --- |
| `PORT`, `OIDC_LISTEN` | `8081`, `0.0.0.0:8081` |
| `OIDC_ISSUER` | `https://auth.howling.life` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | `api`와 같은 값 |
| `OIDC_REDIRECT_URI` | `https://app.howling.life/api/v1/auth/callback` |
| `OIDC_TEST_EMAIL` / `OIDC_TEST_PASSWORD` | 로그인 계정. sealed |

## DNS

`howling.life` 네임서버(hosting.co.kr)에 CNAME 두 개와 소유 확인 TXT 두 개를 넣는다. 값은 `railway domain list --service api --json`으로 다시 볼 수 있다. TXT가 확인되기 전에는 404가 난다.

## 집 runtime

```
RUNTIME_API_URL=wss://app.howling.life/api/v1/runtime/ws
RUNTIME_API_HTTP=https://app.howling.life
```

`/connections`에서 pairing 코드를 만들고 runtime setup 화면(`http://<runtime>:4000/setup`)에 넣는다. 절차는 [Pairing과 HA](./03-pairing-and-ha.md).

## 확인

```bash
railway deployment list --service api --json | jq '.[0].status'
curl -s https://app.howling.life/health
curl -s https://auth.howling.life/.well-known/openid-configuration | jq .issuer
```

이미지는 로컬에서도 같은 Dockerfile로 만들 수 있다.

```bash
docker build -f infra/railway/Dockerfile.api -t howling-api:local .
docker build -f infra/railway/Dockerfile.oidc -t howling-oidc:local .
```
