# Raspberry Pi 4 설치 이미지

한 장의 microSD에 Home Assistant와 Howling runtime이 같이 뜹니다. 클라우드는 `https://app.howling.life`입니다. HA 토큰과 runtime secret은 보드에만 있습니다.

이 문서는 Raspberry Pi 4(64-bit) 전용입니다. Pi 5는 같은 aarch64 이미지를 쓸 수 있지만, 여기서는 Pi 4로 검증한 경로만 적습니다.

## 무엇이 뜨나

| 주소 | 서비스 |
| --- | --- |
| `http://howling.local:8123` | Home Assistant |
| `http://howling.local:4000/setup` | Howling runtime setup · pairing |
| `https://app.howling.life` | 웹 · API. 보드에 설치하지 않음 |

호스트 이름은 `howling`입니다. mDNS가 안 되면 보드의 IPv4로 같은 포트를 엽니다.

두 프로세스는 Docker이고 `network_mode: host`입니다. Hue · Apple TV · mDNS 검색이 보드의 네트워크를 그대로 씁니다.

```text
브라우저 ── app.howling.life (클라우드)
                │ pairing · WSS
Raspberry Pi 4 ─┤
                ├── runtime :4000
                └── Home Assistant :8123
```

## 준비물

- Raspberry Pi 4 (RAM 4 GB 권장. 2 GB도 동작)
- microSD 32 GB 이상 (64 GB 권장)
- 유선 이더넷 권장. Wi‑Fi는 Imager에서 SSID를 넣습니다
- 이 저장소를 클론한 컴퓨터(Docker, `xz`, `curl`)
- Raspberry Pi Imager 또는 `dd`

보드에 이미 Raspberry Pi OS Lite 64-bit가 있으면 [이미 있는 OS에 설치](#이미-있는-raspberry-pi-os에-설치)로 갑니다.

## 설치 이미지 만들기

이미지는 Git에 없습니다. 공식 Raspberry Pi OS Lite 64-bit 위에 HA `2025.8.3`과 Howling runtime을 넣어 `dist/pi4/howling-home-rpi4-64.img.xz`를 만듭니다.

저장소 루트에서:

```bash
cd /path/to/howling
cp .env.example .env
pnpm install

# 이미지에 SSH 사용자까지 넣으려면 둘 다 채웁니다.
# 비밀번호는 집에서 쓰는 값으로 바꿉니다. 아래는 문서 예시입니다.
export HOWLING_PI_USER=howling
export HOWLING_PI_PASSWORD='howling-pi4'

pnpm image:pi4
```

`HOWLING_PI_USER`와 `HOWLING_PI_PASSWORD`를 빼면 사용자는 만들지 않습니다. 그때는 Imager의 OS 커스터마이즈에서 사용자 · SSH · Wi‑Fi를 넣습니다. 빼면 첫 부팅 마법사가 사용자를 물을 수 있습니다.

이 스크립트가 하는 일:

1. `infra/pi4/Dockerfile.runtime`으로 `howling-runtime:pi4` (`linux/arm64`)를 만든다
2. `ghcr.io/home-assistant/home-assistant:2025.8.3`를 받는다
3. 두 이미지를 `dist/pi4/cache/*.tar`로 저장한다
4. 공식 Raspberry Pi OS Lite 64-bit(`2026-06-18`, Trixie)를 받아 SHA-256을 확인한다
5. 루트 파티션을 8 GiB 키운 뒤 `/opt/howling`과 systemd 유닛을 넣는다
6. `dist/pi4/howling-home-rpi4-64.img.xz`와 `.sha256`을 쓴다

결과 예:

```text
dist/pi4/howling-home-rpi4-64.img.xz
dist/pi4/howling-home-rpi4-64.img.xz.sha256
dist/pi4/howling-runtime-linux-arm64.tar
dist/pi4/home-assistant-2025.8.3-linux-arm64.tar
```

이 워크스페이스에서 이미 만든 이미지는 `dist/pi4/howling-home-rpi4-64.img.xz`입니다. SSH 사용자는 `howling`, 비밀번호는 빌드 때 넣은 `HOWLING_PI_PASSWORD`입니다. 문서 예시 값 `howling-pi4`로 만들었다면 첫 로그인 뒤 `passwd`로 바꿉니다.

확인:

```bash
cd dist/pi4
shasum -a 256 -c howling-home-rpi4-64.img.xz.sha256
```

Linux에서는 `sha256sum -c howling-home-rpi4-64.img.xz.sha256`입니다.

같은 일을 스크립트로 직접 호출:

```bash
HOWLING_PI_USER=howling \
HOWLING_PI_PASSWORD='change-me-now' \
bash infra/pi4/image/build.sh
```

다시 만들 때 공식 OS 다운로드를 건너뛰려면 `dist/pi4/cache/2026-06-18-raspios-trixie-arm64-lite.img.xz`와 `dist/pi4/cache/raspios.img`를 그대로 둡니다. runtime만 다시 넣으려면 `dist/pi4/cache/runtime.tar`를 지웁니다.

## 카드에 쓰기

### Raspberry Pi Imager

1. [Raspberry Pi Imager](https://www.raspberrypi.com/software/)를 연다
2. Raspberry Pi Device → **Raspberry Pi 4**
3. Operating System → **Use custom** → `dist/pi4/howling-home-rpi4-64.img.xz`
4. Storage → 쓸 microSD
5. 이미지 빌드에 사용자를 넣지 않았다면 Next → Edit settings
   - username / password
   - Wireless LAN (SSID, password, country `KR`)
   - Enable SSH → Use password authentication
6. Write

이미 빌드에 `HOWLING_PI_USER`를 넣었다면 Wi‑Fi만 Imager에서 넣으면 됩니다. 유선이면 설정을 건너뛰어도 됩니다.

### macOS `dd`

```bash
# 카드를 꽂은 뒤 디스크 번호를 확인한다. 예시는 /dev/disk4 이다. 바꾸지 않으면 다른 디스크를 지운다.
diskutil list

# xz를 풀며 쓴다. rdisk가 disk보다 빠르다.
xz -dc dist/pi4/howling-home-rpi4-64.img.xz \
  | sudo dd of=/dev/rdisk4 bs=4m status=progress

diskutil eject /dev/disk4
```

### Linux `dd`

```bash
lsblk
xz -dc dist/pi4/howling-home-rpi4-64.img.xz \
  | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
```

`sdX`는 `lsblk`로 확인한 카드입니다.

## 첫 부팅

1. 카드를 Pi 4에 넣고 전원과 이더넷(또는 설정한 Wi‑Fi)을 연결한다
2. 첫 기동은 docker 이미지 load 때문에 5–15분이 걸릴 수 있다
3. 같은 네트워크의 컴퓨터에서 확인한다

```bash
ping howling.local
curl -sS http://howling.local:8123
curl -sS http://howling.local:4000/health
```

기대:

```json
{"status":"ok","service":"runtime"}
```

HA는 온보딩 HTML이 나옵니다. runtime `/health`가 404이거나 거절이면 1–2분 더 기다립니다.

SSH(사용자를 넣은 경우):

```bash
ssh howling@howling.local
sudo docker compose --env-file /opt/howling/env -f /opt/howling/compose.yaml ps
sudo journalctl -u howling-home.service -n 100 --no-pager
```

## Home Assistant 계정과 토큰

1. 브라우저에서 `http://howling.local:8123`을 연다
2. 이름 · 사용자 이름 · 비밀번호를 만들어 온보딩을 끝낸다
3. 왼쪽 아래 프로필(또는 사용자 이름) → **보안** → **Long-lived access tokens** → **토큰 만들기**
4. 이름 예: `howling-runtime`
5. 토큰 문자열을 복사한다. 다시 보이지 않는다

토큰을 채팅 · git · 스크린샷에 넣지 않습니다.

## runtime에 HA를 넣고 pairing

1. `http://howling.local:4000/setup`을 연다
2. 허브 URL:

```text
http://127.0.0.1:8123
```

3. Long-lived token에 방금 복사한 값을 넣고 **허브 저장**
4. **Pairing 시작**을 누른다. 사람 코드가 나온다
5. 다른 탭에서 `https://app.howling.life`에 로그인한 뒤 `/connections`를 연다
6. Pairing code에 그 코드를 넣고 **연결**
7. Connections의 runtime이 `online`, `ha-status`가 `ready`면 끝이다

curl로 같은 일:

```bash
# 보드에서, 또는 같은 네트워크의 다른 컴퓨터에서
curl -sS -X POST http://howling.local:4000/v1/setup/ha \
  -H "content-type: application/json" \
  --data '{
    "url": "http://127.0.0.1:8123",
    "token": "HA_LONG_LIVED_TOKEN"
  }'

curl -sS -X POST http://howling.local:4000/v1/setup/pair
curl -sS http://howling.local:4000/v1/setup/status
```

`status` 예:

```json
{
  "haConfigured": true,
  "pairing": {
    "status": "pending",
    "code": "a1b2c3",
    "pairingId": "11111111-1111-1111-1111-111111111111"
  }
}
```

code만 클라우드에 넣습니다. `runtimeSecret`은 사람 화면에 두지 않습니다. pairing 계약은 [Pairing과 HA](./03-pairing-and-ha.md)입니다.

이후 기기 · 플로 · 배포는 [기기](./09-devices.md)와 [편집기와 실행](./04-editor-and-runs.md)입니다.

## 이미 있는 Raspberry Pi OS에 설치

64-bit Raspberry Pi OS Lite(Trixie 또는 Bookworm)가 이미 있고 Docker를 쓸 수 있으면 이미지 없이 같은 compose를 올립니다.

보드에서 저장소를 클론한 뒤:

```bash
cd /path/to/howling
sudo bash infra/pi4/install.sh
```

다른 컴퓨터에서 이미지를 만들어 타르만 넘기려면:

```bash
# 빌드 컴퓨터
docker build --platform linux/arm64 \
  -f infra/pi4/Dockerfile.runtime \
  -t howling-runtime:pi4 .
docker pull --platform linux/arm64 \
  ghcr.io/home-assistant/home-assistant:2025.8.3
mkdir -p dist/pi4
docker save howling-runtime:pi4 -o dist/pi4/runtime.tar
docker save ghcr.io/home-assistant/home-assistant:2025.8.3 \
  -o dist/pi4/home-assistant.tar

scp dist/pi4/runtime.tar dist/pi4/home-assistant.tar \
  howling@howling.local:/tmp/
scp -r infra/pi4 howling@howling.local:/tmp/howling-pi4
```

보드:

```bash
sudo HOWLING_RUNTIME_TAR=/tmp/runtime.tar \
  HOWLING_HA_TAR=/tmp/home-assistant.tar \
  bash /tmp/howling-pi4/install.sh
```

`install.sh`는 `/opt/howling`에 compose와 env를 두고 `howling-home.service`를 켭니다.

수동으로만 올리려면:

```bash
sudo mkdir -p /opt/howling/data/ha /opt/howling/data/runtime
sudo cp infra/pi4/compose.yaml /opt/howling/compose.yaml
sudo cp infra/pi4/env.example /opt/howling/env
sudo cp infra/pi4/ha/configuration.yaml /opt/howling/data/ha/configuration.yaml
cd /opt/howling
sudo docker compose --env-file /opt/howling/env up -d
```

## 파일과 변수

보드 경로:

```text
/opt/howling/compose.yaml
/opt/howling/env
/opt/howling/ha/configuration.yaml
/opt/howling/images/runtime.tar
/opt/howling/images/home-assistant.tar
/opt/howling/data/ha            Home Assistant /config
/opt/howling/data/runtime       sqlite · secrets
```

`/opt/howling/env` 전문:

```bash
HOWLING_HA_VERSION=2025.8.3
HOWLING_RUNTIME_IMAGE=howling-runtime:pi4
HOWLING_DATA=/opt/howling/data
TZ=Asia/Seoul
RUNTIME_API_URL=wss://app.howling.life/api/v1/runtime/ws
RUNTIME_API_HTTP=https://app.howling.life
```

다른 클라우드를 쓰려면, 보드에서:

```bash
sudo sed -i 's#https://app.howling.life#https://app.example.com#g' /opt/howling/env
sudo sed -i 's#wss://app.howling.life#wss://app.example.com#g' /opt/howling/env
sudo systemctl restart howling-home.service
```

토큰 파일은 `${HOWLING_DATA}/runtime/secrets/ha-token`입니다. mode는 runtime이 `0600`으로 둡니다.

## 업데이트

runtime만 다시 넣을 때(저장소가 보드에 있는 경우):

```bash
cd /path/to/howling
git pull
sudo docker build -f infra/pi4/Dockerfile.runtime -t howling-runtime:pi4 .
sudo docker compose --env-file /opt/howling/env -f /opt/howling/compose.yaml up -d runtime
```

이미지를 다시 구워 카드를 쓰는 방법도 있습니다. `/opt/howling/data`를 백업하지 않으면 HA 계정과 pairing이 사라집니다.

```bash
sudo tar -C /opt/howling -czf "$HOME/howling-data.tgz" data
```

복구:

```bash
sudo tar -C /opt/howling -xzf "$HOME/howling-data.tgz"
sudo systemctl restart howling-home.service
```

## HA OS 앱과의 차이

이미 Home Assistant OS를 쓰는 Pi 4라면 이 이미지로 덮어쓰지 않습니다. 그 경우에는 [HA OS 앱](../../infra/ha-addon/README.md)이 runtime만 올립니다. Supervisor가 HA URL을 대신합니다.

이 이미지는 HA OS가 아닙니다. Raspberry Pi OS + Docker로 HA Container와 runtime을 같이 켭니다. 애드온 스토어 · Supervisor는 없습니다.

## 자주 막히는 곳

- **`howling.local`이 안 된다** — 라우터가 mDNS를 막는 경우가 있습니다. `arp -a` 또는 공유기 DHCP 목록에서 보드 IPv4를 찾아 `http://<ip>:8123`으로 엽니다.
- **`:4000/health`가 거절한다** — 첫 부팅 load가 끝나지 않은 것입니다. `sudo journalctl -u howling-home.service -f`를 봅니다.
- **runtime은 뜨는데 HA가 빈 화면** — 온보딩 전입니다. `:8123`에서 계정을 만듭니다. URL은 `http://127.0.0.1:8123`입니다. 클라우드 주소가 아닙니다.
- **pairing 후 offline** — 보드가 `wss://app.howling.life/api/v1/runtime/ws`에 나가야 합니다. `curl -sS https://app.howling.life/health`를 보드에서 실행합니다.
- **이미지가 안 만들어진다** — Docker가 `linux/arm64`를 만들고 `--privileged`로 loop 장치를 써야 합니다. macOS Docker Desktop에서 losetup이 실패하면 로그를 보고, 보드의 Raspberry Pi OS에서 `sudo bash infra/pi4/install.sh`를 씁니다.

다음: [Pairing과 HA](./03-pairing-and-ha.md)
