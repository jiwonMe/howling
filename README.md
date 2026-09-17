# Howling

Howling은 Home Assistant 위에 올리는 자동화입니다. 그래프를 그리고, 배포하고, 실행을 봅니다. 클라우드가 집의 토큰을 들고 있지 않습니다. 기기 id는 `dev_*`입니다. `entity_id`는 클라우드와 초안에 없습니다.

자습서는 [docs/README.md](./docs/README.md)입니다. 패키지 경계는 [docs/packages.md](./docs/packages.md)입니다.

## 지금 되는 것

- 로컬: 테스트 OIDC로 로그인. 프로덕션: [Logto](https://logto.io) + Google. 첫 로그인이 계정과 사이트를 만듭니다. bootstrap 이메일만 기존 `site_dev` / `Home`을 받습니다.
- pairing. 사람 code. HA 토큰은 runtime 파일
- 기기: HA 등록, 가상 생성(`boolean` / `number` / `fields` / `switch` / `binary_sensor` / `sensor`), 대시보드에서 읽기·동작
- `fields` 가상 기기: 한 대에 이름 있는 값 여러 개. `set_fields`. `device.changed`가 필드 변화를 봅니다
- 트리거: `device.changed`, `sun`, `schedule`. 해·스케줄은 MCP·API. 웹 편집기는 `device.changed`와 고급 HA
- 조건 비교값: 숫자·문자열·불리언. `eq` / `neq` / `gt` / `gte` / `lt` / `lte` / `in` / `notIn`
- 초안 YAML. 배포. 실행. 한 스텝. dry-run
- inbound MCP (`POST /mcp`, Bearer). 플로우·실행·기기 도구
- 로컬 전체 `pnpm dev`, 또는 집 runtime만 켜고 클라우드 API에 붙는 `pnpm dev:cloud`
- 프로덕션 웹·API: Railway `app.howling.life`. `main` push가 배포합니다

## 아직 없는 것

모바일 앱, 클라우드 outbound MCP, 다중 사이트 UI는 없습니다. HA OS 애드온은 [`infra/ha-addon`](./infra/ha-addon/README.md)에 있고 마켓 배포는 없습니다.

## 저장소

pnpm 워크스페이스입니다.

```text
apps/api        클라우드 HTTP · WSS hub · 사이트 Postgres
apps/runtime    집 프로세스. HA · SQLite · 실행
apps/web        로그인 · 연결 · 기기 · 편집기 · 로그
packages/contracts  스키마 · 카탈로그
packages/core       순수 실행기
```

## 로컬에서 켜기

`.env`는 `cp .env.example .env`로 만듭니다. 값은 예시 파일 주석을 봅니다.

```bash
cp .env.example .env
pnpm install
docker compose -f infra/compose/compose.yaml up -d postgres oidc
pnpm dev
```

`pnpm dev`는 postgres·테스트 OIDC를 확인한 뒤 api·runtime·web을 함께 켭니다. 의존성만 다시 띄우려면 `pnpm dev:deps`입니다.

브라우저:

```text
http://127.0.0.1:5173
```

테스트 계정은 이메일 `owner@howling.test`, 비밀번호 `howling-dev`입니다. pairing·배포는 [로컬 개발](./docs/product/02-local-dev.md)입니다.

| 경로 | 내용 |
| --- | --- |
| `/` | 기기 현재값 |
| `/connections` | pairing, 허브·MCP, 원본, OAuth, scoped token |
| `/devices` | 허브 기기, 집 기기 연결, 가상 기기 |
| `/flows` | 초안·배포 목록 |
| `/flows/:flowId` | 편집기 |
| `/logs` | 플로 실행 기록 |
| `/runs/:runId` | 실행 상세 |
| `/analytics` | 관측 차트 |

로컬 runtime setup은 `http://127.0.0.1:4000/setup`입니다.

## 집 runtime만 켜고 클라우드에 붙이기

API·웹은 프로덕션을 쓰고, 이 컴퓨터의 runtime만 HA에 붙입니다.

```bash
pnpm dev:cloud
```

기본 클라우드는 `https://app.howling.life`입니다. WebSocket은 `wss://app.howling.life/api/v1/runtime/ws`입니다. `http://127.0.0.1:4000/setup`에서 HA를 넣고 Pairing을 시작합니다. 브라우저는 `https://app.howling.life`에 로그인한 뒤 Connections에 code를 넣습니다. 변수는 [로컬 개발](./docs/product/02-local-dev.md)입니다.

## 프로덕션

웹과 API는 Railway입니다. 공개 주소는 `https://app.howling.life`입니다. 로그인은 Logto(`https://auth.howling.life`)와 Google입니다. 변수와 배포는 [Railway 배포](./docs/product/10-deploy-railway.md)입니다.

## 문서

제품 순서: [docs/README.md](./docs/README.md)

| 문서 | 내용 |
| --- | --- |
| [개요](./docs/product/01-overview.md) | 화면, 로그인, 역할, 시나리오 |
| [로컬 개발](./docs/product/02-local-dev.md) | 설치, 로그인, `pnpm dev:cloud` |
| [Pairing과 HA](./docs/product/03-pairing-and-ha.md) | code, setup, secret |
| [첫 플로우](./docs/core/03-first-flow.md) | power-alert YAML |
| [편집기와 실행](./docs/product/04-editor-and-runs.md) | 배포, 트리거, 한 스텝, dry-run |
| [E2E](./docs/product/05-e2e.md) | Playwright |
| [노드](./docs/core/06-nodes.md) | 카탈로그 |
| [MCP](./docs/product/07-mcp.md) | inbound 도구 |
| [관측](./docs/product/08-analytics-and-data.md) | 로그, 원본 |
| [기기](./docs/product/09-devices.md) | 등록, 가상, `fields`, 트리거 |
| [배포](./docs/product/10-deploy-railway.md) | Railway, Logto |

설계 메모: [DESIGN.md](./DESIGN.md). 로드맵: [plan/product-plan.md](./plan/product-plan.md).

## 테스트

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

`pnpm test:e2e`는 테스트 CA와 Compose 안의 Playwright를 씁니다. 호스트 인증서는 건드리지 않습니다. 절차는 [E2E](./docs/product/05-e2e.md)입니다.

## 화면

로그인:

![로그인](./docs/product/screens/01-login.png)

연결:

![연결](./docs/product/screens/02-connections.png)

기기:

![기기](./docs/product/screens/03-devices.png)

편집기:

![편집기](./docs/product/screens/04-editor.png)

로그:

![로그](./docs/product/screens/05-logs.png)
