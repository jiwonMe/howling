#!/usr/bin/env bash
# Howling Home 첫 기동. docker와 이미지를 준비한 뒤 compose를 쓸 수 있게 한다.
set -euo pipefail

OPT=/opt/howling
MARKER=/var/lib/howling-home/ready

log() {
  echo "[howling-firstboot] $*"
}

need_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "root로 실행하세요." >&2
    exit 1
  fi
}

wait_network() {
  local i
  for i in $(seq 1 60); do
    if getent hosts downloads.raspberrypi.com >/dev/null 2>&1 \
      || getent hosts ghcr.io >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  log "네트워크를 아직 못 찾았습니다. 계속합니다."
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return 0
  fi
  log "docker를 설치합니다."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends docker.io docker-compose-v2 avahi-daemon
  systemctl enable --now docker
  systemctl enable --now avahi-daemon || true
  if ! docker compose version >/dev/null 2>&1; then
    mkdir -p /usr/libexec/docker/cli-plugins
    curl -fL --retry 3 -o /usr/libexec/docker/cli-plugins/docker-compose \
      https://github.com/docker/compose/releases/download/v2.36.2/docker-compose-linux-aarch64
    chmod 0755 /usr/libexec/docker/cli-plugins/docker-compose
  fi
}

load_or_pull() {
  local runtime_image ha_image
  runtime_image="$(grep -E '^HOWLING_RUNTIME_IMAGE=' "${OPT}/env" | cut -d= -f2-)"
  ha_image="ghcr.io/home-assistant/home-assistant:$(grep -E '^HOWLING_HA_VERSION=' "${OPT}/env" | cut -d= -f2-)"
  runtime_image="${runtime_image:-howling-runtime:pi4}"

  if [[ -f "${OPT}/images/runtime.tar" ]]; then
    log "runtime 이미지를 불러옵니다."
    docker load -i "${OPT}/images/runtime.tar"
  elif ! docker image inspect "${runtime_image}" >/dev/null 2>&1; then
    log "runtime 이미지가 없습니다. ${OPT}/images/runtime.tar 를 넣거나 이미지를 만드세요."
    exit 1
  fi

  if [[ -f "${OPT}/images/home-assistant.tar" ]]; then
    log "Home Assistant 이미지를 불러옵니다."
    docker load -i "${OPT}/images/home-assistant.tar"
  elif ! docker image inspect "${ha_image}" >/dev/null 2>&1; then
    log "Home Assistant를 받습니다: ${ha_image}"
    docker pull "${ha_image}"
  fi
}

seed_ha_config() {
  local dest="${OPT}/data/ha/configuration.yaml"
  mkdir -p "${OPT}/data/ha" "${OPT}/data/runtime"
  if [[ ! -f "${dest}" ]]; then
    cp "${OPT}/ha/configuration.yaml" "${dest}"
  fi
}

need_root
if [[ -f "${MARKER}" ]]; then
  exit 0
fi
if [[ ! -f "${OPT}/compose.yaml" || ! -f "${OPT}/env" ]]; then
  echo "${OPT}에 compose.yaml과 env가 없습니다." >&2
  exit 1
fi

wait_network
install_docker
load_or_pull
seed_ha_config
mkdir -p "$(dirname "${MARKER}")"
touch "${MARKER}"
log "준비됐습니다."
