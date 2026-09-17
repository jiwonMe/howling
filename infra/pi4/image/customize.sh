#!/usr/bin/env bash
# privileged Linux 컨테이너에서 Raspberry Pi OS 이미지에 Howling Home을 넣는다.
set -euo pipefail

WORK="${WORK:-/work}"
# shellcheck source=/dev/null
source "${WORK}/infra/pi4/image/manifest.env"

CACHE="${WORK}/dist/pi4/cache"
OUT_IMG="${WORK}/dist/pi4/howling-home-rpi4-64.img"
ROOT=/mnt/howling-root
LOOP=""
MAP_BOOT=""
MAP_ROOT=""

cleanup() {
  set +e
  if [[ -n "${LOOP}" ]]; then
    umount "${ROOT}/dev" "${ROOT}/proc" "${ROOT}/sys" 2>/dev/null
    umount "${ROOT}/boot/firmware" "${ROOT}/boot" 2>/dev/null
    umount "${ROOT}" 2>/dev/null
    kpartx -d "${LOOP}" 2>/dev/null
    losetup -d "${LOOP}" 2>/dev/null
  fi
}
trap cleanup EXIT

log() {
  echo "[howling-image] $*"
}

boot_dir() {
  if [[ -d "${ROOT}/boot/firmware" ]]; then
    echo "${ROOT}/boot/firmware"
  else
    echo "${ROOT}/boot"
  fi
}

wait_maps() {
  local i
  for i in $(seq 1 40); do
    if [[ -b "${MAP_BOOT}" && -b "${MAP_ROOT}" ]]; then
      return 0
    fi
    sleep 0.25
  done
  echo "파티션 맵을 못 찾았습니다: ${MAP_BOOT} ${MAP_ROOT}" >&2
  losetup -a >&2 || true
  ls -l /dev/mapper >&2 || true
  exit 1
}

attach() {
  LOOP="$(losetup -f --show "${OUT_IMG}")"
  kpartx -avs "${LOOP}"
  local base
  base="$(basename "${LOOP}")"
  MAP_BOOT="/dev/mapper/${base}p1"
  MAP_ROOT="/dev/mapper/${base}p2"
  wait_maps
}

resize_image() {
  local raw="${CACHE}/raspios.img"
  log "이미지를 ${IMAGE_EXPAND_GIB}GiB 키웁니다."
  rm -f "${OUT_IMG}"
  cp --sparse=always "${raw}" "${OUT_IMG}"
  truncate -s "+${IMAGE_EXPAND_GIB}G" "${OUT_IMG}"
  parted -s "${OUT_IMG}" resizepart 2 100%
  attach
  e2fsck -f -y "${MAP_ROOT}"
  resize2fs "${MAP_ROOT}"
}

mount_image() {
  mkdir -p "${ROOT}"
  mount "${MAP_ROOT}" "${ROOT}"
  mount "${MAP_BOOT}" "$(boot_dir)"
}

copy_howling() {
  local boot
  boot="$(boot_dir)"
  mkdir -p "${ROOT}/opt/howling/ha" "${ROOT}/opt/howling/images" \
    "${ROOT}/opt/howling/data/ha" "${ROOT}/opt/howling/data/runtime" \
    "${ROOT}/usr/local/sbin"
  install -m 0644 "${WORK}/infra/pi4/compose.yaml" "${ROOT}/opt/howling/compose.yaml"
  install -m 0644 "${WORK}/infra/pi4/env.example" "${ROOT}/opt/howling/env"
  install -m 0644 "${WORK}/infra/pi4/ha/configuration.yaml" \
    "${ROOT}/opt/howling/ha/configuration.yaml"
  install -m 0755 "${WORK}/infra/pi4/firstboot.sh" "${ROOT}/usr/local/sbin/howling-firstboot.sh"
  install -m 0644 "${WORK}/infra/pi4/howling-home.service" \
    "${ROOT}/etc/systemd/system/howling-home.service"
  install -m 0644 "${CACHE}/runtime.tar" "${ROOT}/opt/howling/images/runtime.tar"
  install -m 0644 "${CACHE}/home-assistant.tar" "${ROOT}/opt/howling/images/home-assistant.tar"
  echo "${HOSTNAME}" > "${ROOT}/etc/hostname"
  if grep -q raspberrypi "${ROOT}/etc/hosts"; then
    sed -i "s/raspberrypi/${HOSTNAME}/g" "${ROOT}/etc/hosts"
  else
    echo "127.0.1.1 ${HOSTNAME}" >> "${ROOT}/etc/hosts"
  fi
  mkdir -p "${ROOT}/etc/systemd/system/multi-user.target.wants"
  ln -sf /etc/systemd/system/howling-home.service \
    "${ROOT}/etc/systemd/system/multi-user.target.wants/howling-home.service"
  if [[ -f "${CACHE}/userconf.txt" ]]; then
    install -m 0644 "${CACHE}/userconf.txt" "${boot}/userconf.txt"
    touch "${boot}/ssh"
  fi
}

install_packages() {
  mount --bind /dev "${ROOT}/dev"
  mount --bind /proc "${ROOT}/proc"
  mount --bind /sys "${ROOT}/sys"
  cp /etc/resolv.conf "${ROOT}/etc/resolv.conf"
  chroot "${ROOT}" apt-get update -y
  chroot "${ROOT}" apt-get install -y --no-install-recommends docker.io avahi-daemon
  chroot "${ROOT}" apt-get install -y --no-install-recommends docker-compose-v2 || true
  chroot "${ROOT}" systemctl enable docker avahi-daemon
  umount "${ROOT}/dev" "${ROOT}/proc" "${ROOT}/sys"
}

install_compose_plugin() {
  local dest="${ROOT}/usr/libexec/docker/cli-plugins/docker-compose"
  local url="https://github.com/docker/compose/releases/download/v2.36.2/docker-compose-linux-aarch64"
  mkdir -p "$(dirname "${dest}")"
  curl -fL --retry 3 -o "${dest}" "${url}"
  chmod 0755 "${dest}"
}

if [[ ! -f "${CACHE}/raspios.img" ]]; then
  echo "${CACHE}/raspios.img 가 없습니다." >&2
  exit 1
fi
if [[ ! -f "${CACHE}/runtime.tar" || ! -f "${CACHE}/home-assistant.tar" ]]; then
  echo "runtime.tar 또는 home-assistant.tar 가 없습니다." >&2
  exit 1
fi

resize_image
mount_image
copy_howling
install_packages
install_compose_plugin
log "커스텀 이미지가 준비됐습니다: ${OUT_IMG}"
