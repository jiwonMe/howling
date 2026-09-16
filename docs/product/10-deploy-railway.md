# Railway 배포

클라우드는 Railway 한 프로젝트(`howling`)에 세 서비스로 올린다. runtime은 집(HA OS 앱·Docker)에서 돌고 pairing으로 붙는다.

| 서비스 | 소스 | 도메인 | 역할 |
| --- | --- | --- | --- |
| `api` | `infra/railway/Dockerfile.api` | `app.howling.life` | API + 웹 번들(같은 origin) + runtime WebSocket + MCP |
| `Postgres` | Railway 템플릿 | 비공개 | `${{Postgres.DATABASE_URL}}` |
| `oidc` (선택) | `infra/railway/Dockerfile.oidc` | `auth.howling.life` | 한 계정 테스트 issuer. Google을 쓰면 필요 없다 |

로그인은 Google OIDC다. 회원가입은 따로 없다. **Google로 처음 로그인하면 가입**이고, 그 사람 전용 site(`Home`)가 만들어져 owner가 된다. `BOOTSTRAP_OWNER_EMAIL`과 같은(검증된) 이메일만 기존 bootstrap site를 받는다.

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
| `OIDC_ISSUER` | `https://accounts.google.com` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Google Cloud OAuth 클라이언트. secret은 sealed |
| `OIDC_REDIRECT_URI` | `https://app.howling.life/api/v1/auth/callback` |
| `COOKIE_SECURE` | `true` |
| `BOOTSTRAP_SITE_ID` / `BOOTSTRAP_SITE_NAME` | `site_home` / `Home` |
| `BOOTSTRAP_OWNER_EMAIL` | 운영자 Google 이메일 |
| `BOOTSTRAP_RUNTIME_TOKEN` | 비움. runtime은 pairing으로 붙는다 |

### Google OAuth 클라이언트

1. [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)에서 **OAuth client ID → Web application**.
2. Authorized redirect URI에 `https://app.howling.life/api/v1/auth/callback`. 로컬에서도 Google을 쓰려면 `http://127.0.0.1:5173/api/v1/auth/callback`도 추가.
3. OAuth consent screen이 Testing 상태면 Test users에 넣은 계정만 로그인된다. 누구나 가입하게 하려면 **Publish app**(External).
4. 발급된 client id/secret을 `api`에 넣는다.

```bash
railway variable set OIDC_ISSUER=https://accounts.google.com OIDC_CLIENT_ID=<client-id>.apps.googleusercontent.com --service api
printf "%s" "<client-secret>" | railway variable set OIDC_CLIENT_SECRET --stdin --service api
```

API는 `openid email` scope만 요청하고 `sub`·`email`·`email_verified`만 저장한다.

`oidc` (테스트 issuer를 쓸 때만)

| 키 | 값 |
| --- | --- |
| `PORT`, `OIDC_LISTEN` | `8081`, `0.0.0.0:8081` |
| `OIDC_ISSUER` | `https://auth.howling.life` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | `api`와 같은 값 |
| `OIDC_REDIRECT_URI` | `https://app.howling.life/api/v1/auth/callback` |
| `OIDC_TEST_EMAIL` / `OIDC_TEST_PASSWORD` | 로그인 계정. sealed |

## DNS

`howling.life` 네임서버(hosting.co.kr)에 CNAME과 소유 확인 TXT를 넣는다(`app`, 테스트 issuer를 쓰면 `auth`도). 값은 `railway domain list --service api --json`으로 다시 볼 수 있다. TXT가 확인되기 전에는 404가 난다.

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
