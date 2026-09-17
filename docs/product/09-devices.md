# 기기

사용자는 Home Assistant `entity_id` 대신 Howling **기기**를 고릅니다. 이름·종류·동작만 클라우드와 편집기에 있습니다. `entity_id`는 runtime SQLite `devices`에만 두고, 실행 직전에 HA 서비스로 풀어 씁니다.

## 무엇이 보이는가

| 화면 | 내용 |
| --- | --- |
| `/` 기기 | 집 기기와 가상 기기를 나눔. 타일을 누르면 켜기·끄기·값 변경. 센서·날씨는 목록에만 |
| `/devices` | 이름, 종류, 구분(집/가상), 현재값, 동작, 연결, 수정·삭제. entity id 없음 |
| 편집기 Trigger | 숫자 기기 select. 저장 `{ kind: "device.changed", config: { deviceId, inputKey } }` |
| 편집기 Effect | adapter `device` / `action`. 가상은 `이름 · 가상`. 저장 `inputs.request = { deviceId, action, data? }` |

빈 목록: "아직 기기가 없습니다. 위에서 연결하거나 허브 기기를 기다립니다."

`/devices` **기기 연결**에서 Philips Hue, Shelly, IKEA 등 집 기기를 고릅니다. 맨 위 **가상 기기**는 플로 시험용입니다. 집 기기가 아닙니다. 스위치·숫자는 HA helper로 만들고, Apple TV 같은 제품은 runtime에만 둡니다. 사용자는 Home Assistant 통합 이름을 보지 않습니다. runtime이 허브 config flow 또는 helper 생성을 대행하고, 새 기기가 목록과 편집기 Effect에 나타납니다. 이미 허브에 있는 조명·팬·플레이어·냉난방·커버·잠금·청소기와 냉장고 센서·스위치도 자동으로 나타납니다. Apple TV는 같은 네트워크에서 찾고, 못 찾을 때만 이름·주소를 묻습니다. 연결은 화면 숫자입니다.

고급 경로는 그대로 있습니다. Trigger 「고급: HA entity」는 `ha.state_changed`. Effect 「고급 (HA 서비스)」는 `homeassistant` / `call_service`.

## 첫 슬라이스

- 트리거: 숫자 기기(`sensor`·`input_number`·`number`·`counter` 중 현재 상태가 숫자)와 감지(`binary_sensor`). 감지는 `value` 0/1
- 동작: HA 도메인 서비스와 값. `play_media`·`volume_set`·`send_command`·`set_temperature` 등. 통합 전용 서비스와 `browse_media`는 없음
- 표시 이름: HA `friendly_name`. area·registry 그룹핑 없음. `entity_id`·HA 도메인 이름은 화면에 없음

## id

`dev_` + `sha256(runtimeId + entityId)` 앞 16자. 재동기화에도 같고, 해시에서 entity를 되돌릴 수 없습니다.

## 데이터가 갈라지는 곳

```text
HA get_states / state_changed
→ runtime devices (id, entity_id, name, kind)
→ devices.snapshot (id, name, kind, actions, available, origin?, state?, reading?)  // entity_id 없음. origin은 집(ha)/가상
→ API site_devices
→ /devices · 편집기 select
→ 초안 / artifact 의 deviceId
→ runtime device adapter → homeassistant.call_service
```

검증: `site_devices` · `flow_drafts` · `flow_revisions.artifact_json`에 `input_number.` / `input_boolean.` 문자열이 없어야 합니다. snapshot에 `entityId` 키가 있으면 계약이 거절합니다.

## API · MCP

- `GET /api/v1/sites/:siteId/devices`
- `POST /api/v1/sites/:siteId/devices/:deviceId/actions` `{ action, data? }`. 응답 `{ device }`. `entity_id` 없음
- `PATCH /api/v1/sites/:siteId/devices/:deviceId` `{ name }`. 응답 `{ device }`
- `DELETE /api/v1/sites/:siteId/devices/:deviceId`. 가상과 시험 스위치·숫자만. 그 외 집 기기는 거절. 응답 `{ deviceId }`
- `POST /api/v1/sites/:siteId/devices` `{ name, kind? }` 또는 `{ name, product }` 또는 `{ name, fields }`. `boolean`/`number`만 HA helper. 그 외·제품·여러 값(`fields`)은 runtime 가상. YAML은 화면에서 풀어 이 API를 여러 번 호출합니다. 응답 `{ device, devices }`
- `POST /api/v1/sites/:siteId/devices/integrations` `{ integration?, token?, values?, list? }`
- WSS `devices.integrate` → `devices.integrated`. 허용 목록 밖의 통합·`entity_id`·HA `flow_id`·접속 키는 클라우드에 없음
- 허용 목록은 `@howling/contracts` `DEVICE_INTEGRATIONS`. UI는 제품 이름만 보여 줍니다.
- MCP `list_devices` (`read`), `act_device` (`run`), `create_device`·`update_device`·`delete_device` (`edit`). 응답은 summary만. `create_device`는 `{ name, kind }`, `{ name, product }`, `{ name, fields }` 중 하나. `act_device` `{ deviceId, action, data? }`는 대시보드와 같은 `devices.action` 경로. 여러 값 가상은 `action: "set_fields"`
- WSS `devices.create` → `devices.created`. WSS `devices.action` → `devices.acted`. WSS `devices.update` → `devices.updated`. WSS `devices.delete` → `devices.deleted`. 모두 `entity_id` 없음

숫자 helper 기본값: min 0, max 10000, step 1. 이미 같은 이름이 있으면 그 기기를 돌려줍니다.

가상 기기는 폼 또는 YAML입니다. `entity_id`는 넣지 않습니다. 제품 한 줄은 서버가 여러 기기로 펼칩니다. 대시보드와 목록은 집 기기와 가상 기기를 나눕니다. 화면 문구는 「집」과 「가상」입니다. 이름은 모든 기기에서 바꿀 수 있습니다. 삭제는 가상 기기와 허브에서 만든 시험 스위치·숫자만 됩니다. YAML로 넣은 시험 스위치와 집의 조명·플레이어는 허브에서 빼야 합니다.

```yaml
- name: 작업실 TV
  product: Apple TV
- name: 시험 스위치
  kind: boolean
- name: 작업실 환경
  fields:
    - key: occupied
      type: boolean
      label: 재실
    - key: state
      type: select
      options: [sunny, cloudy, rainy]
    - key: temperature
      type: number
      label: 온도
```

여러 값 가상 기기는 한 대입니다. `kind`는 `fields`. 동작은 `set_fields`이고 `data`에 필드 키를 넣습니다. `key: state` 필드는 `device.read`의 `/state`가 됩니다. 나머지 값은 `/attrs/<key>`입니다. 대시보드 대화상자에서 각 필드를 바로 바꿀 수 있습니다.

`device.changed` 트리거와 `adapter: "device"` Effect는 허브(`ha`) connection이 필요합니다. 미등록 device는 배포를 실패로 보지 않습니다. 나중에 같은 id로 나타나면 그때 실행됩니다.

다음: [관측·원본·설치](./08-analytics-and-data.md)
