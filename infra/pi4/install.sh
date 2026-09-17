#!/usr/bin/env bash
# 이미 켜진 Raspberry Pi OS(64-bit)에 Howling Home을 넣는다.
# 저장소 루트에서: sudo bash infra/pi4/install.sh
# 이미지 안에서는 firstboot가 같은 파일을 /opt/howling에 복사한 뒤 서비스를 켠다.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${HERE}/../.." && pwd)"
DEST="${HOWLING_HOME:-/opt/howling}"

log() {
  echo "[howling-install] $*"
}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "sudo bash infra/pi4/install.sh 로 실행하세요." >&2
  exit 1
fi

if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "이 설치는 Raspberry Pi 4 64-bit(aarch64)만 지원합니다." >&2
  exit 1
fi

mkdir -p "${DEST}/ha" "${DEST}/images" "${DEST}/data/ha" "${DEST}/data/runtime"
install -m 0644 "${HERE}/compose.yaml" "${DEST}/compose.yaml"
install -m 0644 "${HERE}/ha/configuration.yaml" "${DEST}/ha/configuration.yaml"
if [[ ! -f "${DEST}/env" ]]; then
  install -m 0644 "${HERE}/env.example" "${DEST}/env"
fi
install -m 0755 "${HERE}/firstboot.sh" /usr/local/sbin/howling-firstboot.sh
install -m 0644 "${HERE}/howling-home.service" /etc/systemd/system/howling-home.service

if [[ -n "${HOWLING_RUNTIME_TAR:-}" && -f "${HOWLING_RUNTIME_TAR}" ]]; then
  install -m 0644 "${HOWLING_RUNTIME_TAR}" "${DEST}/images/runtime.tar"
fi
if [[ -n "${HOWLING_HA_TAR:-}" && -f "${HOWLING_HA_TAR}" ]]; then
  install -m 0644 "${HOWLING_HA_TAR}" "${DEST}/images/home-assistant.tar"
fi

if [[ ! -f "${DEST}/images/runtime.tar" ]] && ! docker image inspect howling-runtime:pi4 >/dev/null 2>&1; then
  if [[ -f "${ROOT}/infra/pi4/Dockerfile.runtime" && -f "${ROOT}/pnpm-lock.yaml" ]]; then
    log "저장소에서 runtime 이미지를 만듭니다. 시간이 걸립니다."
    docker build -f "${ROOT}/infra/pi4/Dockerfile.runtime" -t howling-runtime:pi4 "${ROOT}"
    docker save howling-runtime:pi4 -o "${DEST}/images/runtime.tar"
  else
    echo "howling-runtime:pi4 이미지가 없습니다. HOWLING_RUNTIME_TAR 또는 저장소를 주세요." >&2
    exit 1
  fi
fi

systemctl daemon-reload
systemctl enable howling-home.service
systemctl restart howling-home.service
log "끝. HA는 http://$(hostname).local:8123 , runtime setup은 http://$(hostname).local:4000/setup"
