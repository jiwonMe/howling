# 로컬 개발

개발은 `http://127.0.0.1:5173`과 Vite proxy입니다. 제품 origin(`https://howling.test`)은 E2E만 씁니다.

## 준비

Node 22 이상, pnpm 10, Docker가 필요합니다.

```bash
cd /path/to/howling
cp .env.example .env
pnpm install
docker compose -f infra/compose/compose.yaml up -d postgres oidc
pnpm dev
```

`pnpm dev`는 postgres·oidc를 띄운 뒤 `@howling/core`와 `@howling/contracts`를 빌드하고 api·runtime·web을 함께 켭니다.

의존성만 다시 띄우려면:

```bash
pnpm dev:deps
```

## 클라우드에 붙여서 개발

runtime과 HA만 로컬에서 켜고 화면·API는 배포된 것을 씁니다. api·web·postgres·oidc는 띄우지 않습니다.

```bash
pnpm dev:cloud
```

하는 일은 이렇습니다.

1. `https://app.howling.life/health`를 확인합니다. 안 닿으면 바로 멈춥니다.
2. HA가 `http://127.0.0.1:8123`에 이미 떠 있으면 그대로 쓰고, 없으면 `infra/compose/compose.ha.yaml`(컨테이너 `howling-ha`)로 띄웁니다.
3. HA 토큰을 `HA_TOKEN` → 이미 저장된 것 → 로컬 dev runtime(`apps/runtime/data/secrets`) 복사 → 새 HA 온보딩 순으로 채웁니다. 넷 다 안 되면 setup 화면에서 직접 넣으라고 알려 줍니다.
4. runtime을 `wss://app.howling.life/api/v1/runtime/ws`로 띄우고 pairing code를 찍습니다. 클라우드 `/connections`에 넣으면 `online`이 됩니다.

sqlite와 secret은 `apps/runtime/data/cloud`에 따로 둡니다. 로컬 dev runtime의 pairing(`apps/runtime/data`)은 그대로 남습니다.

| 변수 | 기본값 | 뜻 |
| --- | --- | --- |
| `HOWLING_CLOUD` | `https://app.howling.life` | 붙을 클라우드 origin |
| `HA_URL` | `http://127.0.0.1:8123` | 쓸 HA 주소 |
| `HA_TOKEN` | 없음 | 있으면 이 장기 토큰을 저장한다 |
| `RUNTIME_PORT` | `4000` | 로컬 runtime 포트 |
| `HOWLING_SKIP_HA` | 없음 | `1`이면 HA를 건드리지 않는다 |
| `HOWLING_RUNTIME_DATA` | `apps/runtime/data/cloud` | sqlite·secret 위치 |

`pnpm dev`가 이미 4000을 쓰고 있으면 포트를 옮깁니다.

```bash
RUNTIME_PORT=4001 pnpm dev:cloud
```

HA만 따로 켜고 끄려면:

```bash
pnpm dev:ha
pnpm dev:ha:down
```

## `.env` 예

루트의 [`.env.example`](../../.env.example)을 그대로 써도 됩니다.

```bash
# API
DATABASE_URL=postgres://howling:howling@127.0.0.1:5432/howling
API_HOST=127.0.0.1
API_PORT=3000
PUBLIC_ORIGIN=http://127.0.0.1:5173
OIDC_ISSUER=http://127.0.0.1:8081
OIDC_CLIENT_ID=howling-web
OIDC_CLIENT_SECRET=howling-dev-secret
OIDC_REDIRECT_URI=http://127.0.0.1:5173/api/v1/auth/callback
COOKIE_SECURE=false
BOOTSTRAP_SITE_ID=site_dev
BOOTSTRAP_SITE_NAME=Dev Site
BOOTSTRAP_OWNER_EMAIL=owner@howling.test
BOOTSTRAP_RUNTIME_ID=runtime_dev
BOOTSTRAP_RUNTIME_TOKEN=dev-runtime-token

# Runtime
RUNTIME_HOST=127.0.0.1
RUNTIME_PORT=4000
RUNTIME_ID=runtime_dev
RUNTIME_SITE_ID=site_dev
RUNTIME_API_URL=ws://127.0.0.1:3000/api/v1/runtime/ws
RUNTIME_TOKEN=dev-runtime-token
RUNTIME_SQLITE_PATH=apps/runtime/data/runtime.sqlite

# OIDC
OIDC_LISTEN=127.0.0.1:8081
OIDC_TEST_EMAIL=owner@howling.test
OIDC_TEST_PASSWORD=howling-dev
```

`BOOTSTRAP_RUNTIME_TOKEN`이 비어 있으면 API는 bootstrap runtime을 등록하지 않습니다. E2E는 빈 토큰 + pairing만 씁니다. `pnpm dev`는 편의용 bootstrap token을 유지합니다.

## 포트

| 주소 | 서비스 |
| --- | --- |
| `http://127.0.0.1:5173` | Vite web. `/api`, `/health`, `/ready`를 api로 proxy |
| `http://127.0.0.1:3000` | api |
| `http://127.0.0.1:4000` | runtime. 클라우드 path를 복제하지 않음 |
| `http://127.0.0.1:4000/setup` | HA·pairing HTML |
| `http://127.0.0.1:8081` | 테스트 OIDC |
| `http://127.0.0.1:8123` | 로컬 Home Assistant. `pnpm dev:ha` |
| `127.0.0.1:5432` | PostgreSQL `howling` / `howling` / `howling` |

## 로그인

1. `http://127.0.0.1:5173`을 연다.
2. 상태 화면이 401이면 `/api/v1/auth/login`으로 보낸다.
3. 테스트 issuer 폼에 아래를 넣는다.

```text
이메일: owner@howling.test
비밀번호: howling-dev
```

4. 콜백 후 `Howling` 제목과 API·runtime 카드가 보이면 성공이다.

## 기동 확인

다른 터미널에서:

```bash
curl -sS http://127.0.0.1:3000/health
curl -sS http://127.0.0.1:3000/ready
curl -sS http://127.0.0.1:4000/health
```

기대 예:

```json
{"status":"ok","service":"api"}
```

```json
{"status":"ok","service":"runtime"}
```

`/ready`의 `checks.database`가 `true`여야 합니다.

로그인 세션이 있으면 runtime 카드가 `online`이어야 합니다. bootstrap token이 맞으면 pairing 없이도 붙습니다.

## 단위 테스트

```bash
pnpm test
pnpm typecheck
pnpm build
```

`@howling/core` 테스트는 40개입니다. 제품 작업이 core 소스를 바꾸면 안 됩니다.

## 자주 막히는 곳

- **OIDC가 안 뜬다** — `docker compose -f infra/compose/compose.yaml ps`로 `oidc` healthy를 본다. `pnpm --filter @howling/oidc-test build` 후 compose를 다시 올린다.
- **Vite는 뜨는데 로그인이 루프한다** — `.env`의 `OIDC_REDIRECT_URI`와 `PUBLIC_ORIGIN`이 `5173`인지 확인한다.
- **runtime이 offline** — `RUNTIME_TOKEN`과 API `BOOTSTRAP_RUNTIME_TOKEN`이 같아야 한다. pairing을 쓰면 [Pairing과 HA](./03-pairing-and-ha.md)로 간다.

다음: [Pairing과 HA](./03-pairing-and-ha.md)
