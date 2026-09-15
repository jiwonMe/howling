# 기기

사용자는 Home Assistant `entity_id` 대신 Howling **기기**를 고릅니다. 이름·종류·동작만 클라우드와 편집기에 있습니다. `entity_id`는 runtime SQLite `devices`에만 두고, 실행 직전에 HA 서비스로 풀어 씁니다.

## 무엇이 보이는가

| 화면 | 내용 |
| --- | --- |
| `/devices` | 이름, 종류, 동작, 사용 가능 여부 |
| 편집기 Trigger | 숫자 기기 select. 저장 `{ kind: "device.changed", config: { deviceId, inputKey } }` |
| 편집기 Effect | adapter `device` / `action`. 저장 `inputs.request = { deviceId, action }` |

빈 목록: "허브가 연결되면 기기가 나타납니다."

고급 경로는 그대로 있습니다. Trigger 「고급: HA entity」는 `ha.state_changed`. Effect 「고급 (HA 서비스)」는 `homeassistant` / `call_service`.

## 첫 슬라이스

- 트리거: `sensor` · `input_number` · `number` 중 **현재 상태가 숫자**인 기기
- 동작: `light` · `switch` · `input_boolean` · `fan`의 `turn_on` / `turn_off` / `toggle`
- 표시 이름: HA `friendly_name`. area·registry 그룹핑 없음

## id

`dev_` + `sha256(runtimeId + entityId)` 앞 16자. 재동기화에도 같고, 해시에서 entity를 되돌릴 수 없습니다.

## 데이터가 갈라지는 곳

```text
HA get_states / state_changed
→ runtime devices (id, entity_id, name, kind)
→ devices.snapshot (id, name, kind, actions, available)  // entity_id 없음
→ API site_devices
→ /devices · 편집기 select
→ 초안 / artifact 의 deviceId
→ runtime device adapter → homeassistant.call_service
```

검증: `site_devices` · `flow_drafts` · `flow_revisions.artifact_json`에 `input_number.` / `input_boolean.` 문자열이 없어야 합니다. snapshot에 `entityId` 키가 있으면 계약이 거절합니다.

## API · MCP

- `GET /api/v1/sites/:siteId/devices`
- MCP `list_devices` (`read`). 응답은 summary만

`device.changed` 트리거와 `adapter: "device"` Effect는 허브(`ha`) connection이 필요합니다. 미등록 device는 배포를 실패로 보지 않습니다. 나중에 같은 id로 나타나면 그때 실행됩니다.

다음: [관측·원본·설치](./08-analytics-and-data.md)
