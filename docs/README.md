# Howling 문서

Howling은 Home Assistant를 이용한 시각적 자동화 플랫폼입니다. 편집기, 로컬 runner, 클라우드, MCP는 뒤에 붙고, 지금은 그 공통 실행 엔진인 `@howling/core`만 있습니다.

이 폴더는 **자습서**입니다. 위에서 아래로 읽으면 플로를 정의하고, 컴파일하고, 한 칸씩 실행하고, 외부 작업을 fixture로 재현할 수 있습니다. 설계 원문은 [`plan/core-plan.md`](../plan/core-plan.md)입니다.

## 학습 순서

1. [패키지 지도](./packages.md) — 저장소와 패키지 경계
2. [Core가 하는 일](./core/01-overview.md) — 포함·제외, 공개 API
3. [핵심 개념](./core/02-concepts.md) — 정의, 연결, 값 참조, run
4. [첫 플로](./core/03-first-flow.md) — 복사해 실행하는 최소 예제
5. [Compile과 진단](./core/04-compile.md) — 잘못된 그래프를 고치는 방법
6. [step과 run](./core/05-step-and-run.md) — 단계 실행과 자동 실행
7. [공식 노드](./core/06-nodes.md) — input, map, condition, 분석
8. [분기와 합류](./core/07-branch-and-join.md) — 조건, ALL, ANY, 오류 경로
9. [Effect와 시간](./core/08-effects-and-time.md) — 외부 작업, timer, command
10. [Dry run](./core/09-dry-run.md) — fixture로 알림·조회를 재현
11. [Snapshot과 Host](./core/10-snapshot-and-host.md) — 저장, 복원, 전달 책임
12. [노드를 직접 등록](./core/11-custom-nodes.md) — registry에 새 타입 추가

## 바로 실행

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

브라우저에서 core를 불러보려면 `file://`가 아니라 HTTP를 씁니다.

```bash
pnpm --filter @howling/core build
pnpm --filter @howling/core smoke:browser
```

브라우저에서 `http://127.0.0.1:4173/examples/browser-smoke.html` 을 엽니다.
