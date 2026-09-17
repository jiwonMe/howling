#!/usr/bin/env bash
# Raspberry Pi 4용 Howling Home SD 이미지를 만든다.
# 결과: dist/pi4/howling-home-rpi4-64.img.xz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/infra/pi4/image/manifest.env"

CACHE="${ROOT}/dist/pi4/cache"
OUT_DIR="${ROOT}/dist/pi4"
IMG="${OUT_DIR}/howling-home-rpi4-64.img"
XZ="${IMG}.xz"
PLATFORM="${HOWLING_PLATFORM:-linux/arm64}"

log() {
  echo "[howling-image] $*"
}

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 이(가) 필요합니다." >&2
    exit 1
  fi
}

download_base() {
  mkdir -p "${CACHE}"
  local xz="${CACHE}/${RASPIOS_FILE}"
  local sha="${xz}.sha256"
  if [[ ! -f "${xz}" ]]; then
    log "Raspberry Pi OS를 받습니다."
    curl -fL --retry 3 -o "${xz}" "${RASPIOS_URL}"
  fi
  curl -fL --retry 3 -o "${sha}" "${RASPIOS_URL}.sha256"
  (
    cd "${CACHE}"
    check_sum "$(basename "${sha}")"
  )
  if [[ ! -f "${CACHE}/raspios.img" ]]; then
    log "공식 이미지를 풉니다."
    xz -T0 -dkc "${xz}" > "${CACHE}/raspios.img"
  fi
}

save_containers() {
  log "runtime 이미지를 ${PLATFORM}으로 만듭니다."
  docker build \
    --platform "${PLATFORM}" \
    -f "${ROOT}/infra/pi4/Dockerfile.runtime" \
    -t "${RUNTIME_IMAGE}" \
    "${ROOT}"
  log "Home Assistant를 받습니다: ${HA_IMAGE}"
  docker pull --platform "${PLATFORM}" "${HA_IMAGE}"
  docker save "${RUNTIME_IMAGE}" -o "${CACHE}/runtime.tar"
  docker save "${HA_IMAGE}" -o "${CACHE}/home-assistant.tar"
}

write_userconf() {
  rm -f "${CACHE}/userconf.txt"
  if [[ -z "${HOWLING_PI_USER:-}" || -z "${HOWLING_PI_PASSWORD:-}" ]]; then
    log "HOWLING_PI_USER / HOWLING_PI_PASSWORD 가 없습니다. Imager에서 사용자를 만드세요."
    return 0
  fi
  local hash
  hash="$(openssl passwd -6 "${HOWLING_PI_PASSWORD}")"
  printf '%s:%s\n' "${HOWLING_PI_USER}" "${hash}" > "${CACHE}/userconf.txt"
  log "이미지에 사용자 ${HOWLING_PI_USER} 와 SSH를 넣었습니다."
}

customize() {
  log "Linux 컨테이너에서 파티션을 수정합니다."
  docker run --rm --privileged \
    --platform linux/arm64 \
    -e WORK=/work \
    -v "${ROOT}:/work" \
    debian:trixie-slim \
    bash -lc 'apt-get update -y && apt-get install -y --no-install-recommends \
      ca-certificates curl e2fsprogs kpartx parted util-linux mount udev \
      && bash /work/infra/pi4/image/customize.sh'
}

compress() {
  log "xz로 압축합니다."
  rm -f "${XZ}"
  xz -T0 -9 -k "${IMG}"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${OUT_DIR}" && sha256sum "$(basename "${XZ}")" > "$(basename "${XZ}").sha256")
  else
    (cd "${OUT_DIR}" && shasum -a 256 "$(basename "${XZ}")" > "$(basename "${XZ}").sha256")
  fi
  log "끝났습니다: ${XZ}"
  ls -lh "${XZ}" "${XZ}.sha256"
}

check_sum() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "${file}"
    return
  fi
  shasum -a 256 -c "${file}"
}

need docker
need curl
need xz
need openssl
mkdir -p "${CACHE}" "${OUT_DIR}"
download_base
save_containers
write_userconf
customize
compress
