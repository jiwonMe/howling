# Railway 배포

클라우드는 Railway 한 프로젝트(`howling`)에 올린다. runtime은 집(HA OS 앱·Docker)에서 돌고 pairing으로 붙는다.

| 서비스 | 소스 | 도메인 | 역할 |
| --- | --- | --- | --- |
| `api` | `infra/railway/Dockerfile.api` | `app.howling.life` | API + 웹 번들(같은 origin) + runtime WebSocket + MCP |
| `Postgres` | Railway 템플릿 | 비공개 | `${{Postgres.DATABASE_URL}}` |
| `logto` | Docker 이미지 `svhd/logto:latest` | `auth.howling.life` (3001), 콘솔은 Railway 도메인 (3002) | 로그인·회원가입을 맡는 OIDC issuer |
| `Postgres-0dIj` | Railway 템플릿 | 비공개 | Logto 전용 DB. Howling과 테이블 이름(`users`)이 겹쳐서 따로 둔다 |

로그인은 [Logto](https://logto.io)가 맡는다. 회원가입 화면·Google 로그인·이메일 인증은 전부 Logto 쪽 설정이고, Howling API는 OIDC client로 `sub`·`email`·`email_verified`만 받는다. **처음 로그인하면 가입**이고, 그 사람 전용 site(`Home`)가 만들어져 owner가 된다. `BOOTSTRAP_OWNER_EMAIL`과 같은(검증된) 이메일만 기존 bootstrap site를 받는다.

GitHub `jiwonMe/howling`의 `main`에 push하면 `api`가 다시 빌드된다. `logto`는 이미지라 저장소와 무관하다.

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
| `OIDC_ISSUER` | `https://auth.howling.life/oidc` (Logto issuer는 `/oidc`가 붙는다) |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Logto 콘솔 → Applications → `Howling`의 App ID / App Secret. secret은 sealed |
| `OIDC_REDIRECT_URI` | `https://app.howling.life/api/v1/auth/callback` |
| `COOKIE_SECURE` | `true` |
| `BOOTSTRAP_SITE_ID` / `BOOTSTRAP_SITE_NAME` | `site_home` / `Home` |
| `BOOTSTRAP_OWNER_EMAIL` | 운영자 이메일 |
| `BOOTSTRAP_RUNTIME_TOKEN` | 비움. runtime은 pairing으로 붙는다 |

`logto`

| 키 | 값 |
| --- | --- |
| `DB_URL` | `${{Postgres-0dIj.DATABASE_URL}}` |
| `PORT` / `ADMIN_PORT` | `3001` / `3002` |
| `ENDPOINT` | `https://auth.howling.life` |
| `ADMIN_ENDPOINT` | `https://logto-production-c863.up.railway.app` |
| `TRUST_PROXY_HEADER` | `1` |

시작 명령은 `sh -c "npm run cli db seed -- --swe; npm run alteration deploy latest; npm start"`, healthcheck는 `/api/status`. 도메인은 두 개다: 커스텀 `auth.howling.life`는 3001(issuer·로그인 화면·Management API), Railway 생성 도메인은 3002(Admin Console).

### Logto 콘솔에서 할 일

1. **Applications → Create app without framework → Traditional Web**, 이름 `Howling`. Redirect URI에 `https://app.howling.life/api/v1/auth/callback`. App ID/Secret을 `api`에 넣는다.
2. **Connectors → Social connectors → Google**. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)에서 OAuth client(Web application)를 만들고 Authorized redirect URI에 Logto가 알려주는 `https://auth.howling.life/callback/<connector-id>`를 넣는다. client id/secret을 커넥터에 저장.
3. **Sign-in & account → Sign-up and sign-in**. Sign-up identifier를 Email로 두거나, 소셜만 쓰려면 "Not applicable"로 두고 Social sign-in에 Google을 추가한다. 이메일 인증 코드를 쓰려면 Email connector도 하나 붙여야 한다.

```bash
railway variable set OIDC_ISSUER=https://auth.howling.life/oidc OIDC_CLIENT_ID=<app-id> --service api
printf "%s" "<app-secret>" | railway variable set OIDC_CLIENT_SECRET --stdin --service api
```

API는 `openid email` scope만 요청한다. Logto는 이 scope로 `email`·`email_verified`를 id_token에 넣는다.

### 로컬 개발

로컬은 그대로 `infra/oidc`의 한 계정 테스트 issuer(`pnpm dev`가 띄움)를 쓴다. Logto를 로컬에서 쓰고 싶으면 `.env`의 `OIDC_ISSUER=https://auth.howling.life/oidc`와 App ID/Secret을 넣고, Logto 앱의 Redirect URI에 `http://127.0.0.1:5173/api/v1/auth/callback`을 추가한다.

## DNS

`howling.life` 네임서버(hosting.co.kr)에 넣는 레코드. 값은 `railway domain status <도메인> --service <서비스> --json`으로 다시 볼 수 있다.

| 타입 | 이름 | 값 |
| --- | --- | --- |
| CNAME | `app` | `railway domain status app.howling.life --service api`의 `requiredValue` |
| TXT | `_railway-verify.app` | 같은 명령의 `verificationToken` |
| CNAME | `auth` | `railway domain status auth.howling.life --service logto`의 `requiredValue` |
| TXT | `_railway-verify.auth` | 같은 명령의 `verificationToken` |

TXT가 확인되고 인증서가 나오기 전에는 404·TLS 오류가 난다. hosting.co.kr 존의 negative TTL이 180초라 새 레코드가 공개 resolver에 보이기까지 몇 분 걸린다.

## 집 runtime

```
RUNTIME_API_URL=wss://app.howling.life/api/v1/runtime/ws
RUNTIME_API_HTTP=https://app.howling.life
```

`/connections`에서 pairing 코드를 만들고 runtime setup 화면(`http://<runtime>:4000/setup`)에 넣는다. 절차는 [Pairing과 HA](./03-pairing-and-ha.md).

개발 기계에서 runtime과 HA만 띄워 이 배포에 붙이려면 `pnpm dev:cloud`다. [로컬 개발](./02-local-dev.md)의 "클라우드에 붙여서 개발"을 본다. Raspberry Pi 4 한 장에 HA와 runtime을 같이 올리려면 [Raspberry Pi 4](./11-raspberry-pi.md)다.

## 확인

```bash
railway deployment list --service api --json | jq '.[0].status'
curl -s https://app.howling.life/health
curl -s https://auth.howling.life/oidc/.well-known/openid-configuration | jq .issuer
curl -sI https://app.howling.life/api/v1/auth/login | grep -i '^location'   # auth.howling.life/oidc/auth 로 302
```

`api` 이미지는 로컬에서도 같은 Dockerfile로 만들 수 있다.

```bash
docker build -f infra/railway/Dockerfile.api -t howling-api:local .
```
