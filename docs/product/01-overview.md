# 개요

Howling은 Home Assistant 위에 올리는 자동화입니다. 브라우저에서 그래프를 그리고 클라우드가 배포합니다. 실행은 집의 runtime입니다. 클라우드 Postgres에는 초안·revision·실행 요약이 있습니다. HA 토큰과 기기 원본은 집에 있습니다.

로그인 뒤에 사이트가 생깁니다. 로컬은 테스트 OIDC입니다. 프로덕션은 Logto와 Google입니다. 첫 로그인이 계정과 그 계정의 사이트를 만듭니다. 사이트에 runtime을 pairing하면 배포와 실행이 됩니다.

## 화면

로그인 뒤에 사이드바가 있습니다. 기본 랜딩은 기기입니다.

| 경로 | 하는 일 |
| --- | --- |
| `/` | 기기 현재값. 로그인 뒤 기본 화면 |
| `/connections` | runtime pairing. HA URL은 집 setup |
| `/devices` | 등록·가상 생성·읽기·동작 |
| `/flows` | 플로 목록 |
| `/flows/:flowId` | 편집기. 초안·배포 |
| `/logs` | 실행 목록 |
| `/runs/:runId` | 실행 상세 |
| `/analytics` | 관측 |

로그인은 `/api/v1/auth/login`입니다. 로컬은 테스트 IdP, 프로덕션은 Logto / Google입니다.

로그인:

![로그인](./screens/01-login.png)

연결:

![연결](./screens/02-connections.png)

기기:

![기기](./screens/03-devices.png)

편집기:

![편집기](./screens/04-editor.png)

로그:

![로그](./screens/05-logs.png)

## 역할

| 이름 | 위치 | 하는 일 |
| --- | --- | --- |
| 웹 | 브라우저 | 로그인, pairing, 기기, 초안, 배포, 로그 |
| API | 클라우드 | 세션, 사이트, 초안, revision, inbound MCP, runtime WSS |
| Runtime | 집 | HA, 가상 기기, 트리거, 실행, SQLite |
| Core | 라이브러리 | 순수 실행. I/O 없음 |

브라우저와 API 사이 플로우 URL은 사이트 아래입니다.

```text
/api/v1/sites/:siteId/flows
/api/v1/sites/:siteId/flows/:flowId
/api/v1/sites/:siteId/flows/:flowId/revisions
/api/v1/sites/:siteId/flows/:flowId/revisions/:rev/deploy
```

기기는 `/api/v1/sites/:siteId/devices`입니다. MCP는 `POST /mcp`입니다.

## 누가 무엇을 보나

사람 화면과 MCP 도구는 같은 허브 기기입니다. `entity_id`는 클라우드 응답과 초안에 없습니다.

| 주체 | 기기에서 보는 것 |
| --- | --- |
| 사람 · MCP | `id`, `name`, `kind`, `origin`, `capabilities`, `integration`. `fields`면 필드 목록 |
| Runtime | HA `entity_id`, 가상 필드 정의, 로컬 상태 |

## 시나리오

전력 알림: 허브에 전력 센서와 스위치가 있습니다. `device.changed`가 센서 `power`를 봅니다. 평균이 1200을 넘으면 스위치를 켭니다. YAML은 [첫 플로우](../core/03-first-flow.md)입니다.

여러 값 가상 기기: 방석처럼 `sit`(착석)과 `pressure`를 한 대에 둡니다. `sit`이 참이 되면 `device.changed`가 흐르고 스튜디오 스위치를 켭니다. 필드와 트리거 입력은 [기기](./09-devices.md)입니다.

해·스케줄: `sun`(`sunset` / `sunrise`)과 `schedule`(`HH:mm`, 요일)은 MCP·API로 초안에 넣습니다. 웹 편집기 트리거 칸은 `device.changed`와 고급 HA입니다.

## 로컬과 클라우드

로컬은 `pnpm dev`로 api · runtime · web · 테스트 OIDC를 같이 켭니다. 집 runtime만 켜고 `https://app.howling.life`에 붙이려면 `pnpm dev:cloud`입니다. 절차는 [로컬 개발](./02-local-dev.md)입니다.

다음: [로컬 개발](./02-local-dev.md)
