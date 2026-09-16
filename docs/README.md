# Howling 문서

Howling은 Home Assistant를 이용한 시각적 자동화 플랫폼입니다. 웹에서 플로를 만들고, 로컬 runtime이 실제 장치를 움직이며, 같은 실행이 화면으로 돌아옵니다.

문서는 두 갈래입니다.

- **제품** — 로그인부터 pairing, 편집기, 배포, HA, E2E까지 지금 돌아가는 앱
- **Core** — `@howling/core` 실행 엔진. HA 없이 JSON과 fixture로 검증

설계 원문은 [`plan/product-plan.md`](../plan/product-plan.md)와 [`plan/core-plan.md`](../plan/core-plan.md)입니다.

## 제품

1. [패키지 지도](./packages.md) — 워크스페이스와 의존 경계
2. [제품 개요](./product/01-overview.md) — 구성, 완료 조건, 아직 없는 것
3. [로컬 개발](./product/02-local-dev.md) — `pnpm dev`, 계정, 포트
4. [Pairing과 HA](./product/03-pairing-and-ha.md) — 로컬 setup, secret, 준비 상태
5. [편집기와 실행](./product/04-editor-and-runs.md) — 초안, revision, 배포, run
6. [E2E](./product/05-e2e.md) — `howling.test`, 테스트 CA, 전력 평균 시나리오
7. [Dry-run](./product/06-dry-run.md)
8. [MCP](./product/07-mcp.md)
9. [관측·원본·설치](./product/08-analytics-and-data.md)
10. [기기](./product/09-devices.md)
11. [Railway 배포](./product/10-deploy-railway.md) — `app.howling.life`, `auth.howling.life`, GitHub 자동 배포

## Core 자습서

1. [Core가 하는 일](./core/01-overview.md)
2. [핵심 개념](./core/02-concepts.md)
3. [첫 플로](./core/03-first-flow.md)
4. [Compile과 진단](./core/04-compile.md)
5. [step과 run](./core/05-step-and-run.md)
6. [공식 노드](./core/06-nodes.md)
7. [분기와 합류](./core/07-branch-and-join.md)
8. [Effect와 시간](./core/08-effects-and-time.md)
9. [Dry run](./core/09-dry-run.md)
10. [Snapshot과 Host](./core/10-snapshot-and-host.md)
11. [노드를 직접 등록](./core/11-custom-nodes.md)

## 바로 실행

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

로컬 앱:

```bash
cp .env.example .env
docker compose -f infra/compose/compose.yaml up -d postgres oidc
pnpm dev
```

브라우저에서 `http://127.0.0.1:5173` — `owner@howling.test` / `howling-dev`.

Core만 브라우저에서 보려면 `file://`가 아니라 HTTP를 씁니다.

```bash
pnpm --filter @howling/core build
pnpm --filter @howling/core smoke:browser
```

`http://127.0.0.1:4173/examples/browser-smoke.html` 을 엽니다.
