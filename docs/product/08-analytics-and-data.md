# 관측·원본·설치

단계 5는 설치→연결→작성→시험→배포→관측을 제품 화면으로 닫습니다.

## 원본과 요약

요약(`summary.batch`)은 계속 sequence·type·nodeId·status만 올립니다. 센서 값·effect payload·원문 오류는 기본 cloud DB·SSE·로그에 없습니다.

원본 전송은 기본 OFF입니다. `/connections`의 **원본 전송 ON**과 편집기 **원본**이 모두 켜진 뒤에 생긴 이벤트만 `raw.batch`로 올라갑니다. 과거 실행을 소급하지 않습니다.

OFF로 바꾼 뒤 재접속하면 대기 raw는 payload를 버리고 같은 `syncSeq` tombstone으로 ACK됩니다. OFF가 이미 저장된 클라우드 원본 삭제를 끝냈다고 표시하지 않습니다. 삭제는 **저장된 클라우드 원본 삭제**입니다.

상세 조회 `POST /runs/:runId/detail-requests`는 `data.read`가 필요합니다. 응답은 중계만 하고 cloud에 저장하지 않으며 원본 ON을 켜지 않습니다. runtime offline이거나 정리된 원본이면 `raw_unavailable`입니다.

보관 기본값: 로컬 원본 7일, 클라우드 요약 30일, 클라우드 원본 7일, 로컬 합계 1 GiB. 진행 중 snapshot·미해소 outbox·활성 artifact·live 분석 상태는 지우지 않습니다.

## 관측

`/analytics`에서 flow·node·JSON Pointer를 고릅니다. runtime observer가 commit된 이벤트만 읽어 숫자 sample을 만듭니다. observer 실패는 실행을 멈추지 않습니다.

첫 화면 위젯: 시계열, 실행 횟수·성공률, 노드 이벤트 수, 최근 오류.

## 설치

Docker:

```bash
cp .env.example .env
pnpm install
docker compose -f infra/compose/compose.yaml up -d postgres oidc
pnpm dev
```

브라우저 `http://127.0.0.1:5173` → 로그인 `owner@howling.test` / `howling-dev` → runtime `http://127.0.0.1:4000/setup`에서 HA·MCP·pairing → `/connections`에서 code 입력 → `/flows`에서 작성·시험·배포 → `/analytics`에서 관측 필드를 고릅니다.

HA OS 앱은 [infra/ha-addon](../../infra/ha-addon/README.md)입니다. Supervisor 토큰이 있으면 HA URL을 다시 넣지 않습니다. Raspberry Pi 4에서 HA와 runtime을 한 이미지로 켜려면 [Raspberry Pi 4](./11-raspberry-pi.md)입니다.

## OAuth

연결 화면의 제공자 목록과 runtime `/setup`의 MCP OAuth 폼이 같은 PKCE 중계를 씁니다. API는 authorization code를 저장하지 않습니다.
