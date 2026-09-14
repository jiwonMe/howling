# Howling

Home Assistant를 이용한 시각적 자동화 플랫폼입니다. 공통 실행 엔진 `@howling/core`와 단계 0 앱 골격(web·api·runtime)이 있습니다.

자습서는 [`docs/README.md`](./docs/README.md)부터 읽습니다. 패키지 지도는 [`docs/packages.md`](./docs/packages.md)입니다.

```bash
pnpm install
docker compose -f infra/compose/compose.yaml up -d postgres oidc
pnpm dev
```

브라우저에서 `http://127.0.0.1:5173`을 열고 테스트 계정 `owner@howling.test` / `howling-dev`로 로그인합니다.

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm verify:phase0
```
