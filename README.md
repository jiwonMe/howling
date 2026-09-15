# Howling

Home Assistant를 노드로 자동화하는 제품입니다. 브라우저에서 플로를 만들고 배포하면, 로컬 runtime이 실제 HA helper를 바꾸고 같은 실행이 화면에 나타납니다.

자습서는 [`docs/README.md`](./docs/README.md)입니다. 패키지 경계는 [`docs/packages.md`](./docs/packages.md)입니다. 전체 로드맵은 [`plan/product-plan.md`](./plan/product-plan.md)입니다.

## 지금 되는 것

- 로그인, pairing, 허브 WebSocket 준비 상태
- 기기 목록. 초안·cloud에는 `deviceId`만, `entity_id`는 runtime에만
- React Flow 편집기에서 초안 저장·검증·revision·배포
- `device.changed` trigger → `@howling/core` 실행 → `device.action` → 로컬 HA 서비스
- 실행 상세 5초 polling
- `https://howling.test` E2E (테스트 CA는 Playwright 컨테이너만 신뢰)

아직 없는 것: 호스트에 테스트 CA 설치, 플러그인 마켓.

## 로컬 개발

```bash
cp .env.example .env
pnpm install
docker compose -f infra/compose/compose.yaml up -d postgres oidc
pnpm dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다. 테스트 계정은 `owner@howling.test` / `howling-dev`입니다.

`pnpm dev`는 `.env`의 `BOOTSTRAP_RUNTIME_TOKEN`으로 runtime을 바로 붙입니다. 제품 연결 경로는 pairing입니다. 자세한 절차는 [로컬 개발](./docs/product/02-local-dev.md)과 [Pairing과 HA](./docs/product/03-pairing-and-ha.md)입니다.

## 검증

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

`pnpm test:e2e`는 호스트 인증서를 건드리지 않습니다. Compose 안의 Playwright만 테스트 CA를 신뢰합니다. 시나리오는 [E2E](./docs/product/05-e2e.md)입니다.

## 화면

| 경로 | 내용 |
| --- | --- |
| `/` | API·runtime·허브 상태 |
| `/connections` | pairing, 허브·MCP, 원본 전송·보관, OAuth 제공자, scoped token |
| `/devices` | 허브 기기 이름·종류·동작 |
| `/flows` | 초안·배포 목록 |
| `/flows/:flowId` | 편집기 |
| `/runs/:runId` | 실행 상세 |
| `/analytics` | 관측 차트·필드 선택 |

로컬 runtime setup 페이지는 `http://127.0.0.1:4000/setup`입니다. 허브 토큰은 클라우드에 올리지 않습니다. HA OS 앱은 자동, Docker는 주소·토큰을 넣습니다.
