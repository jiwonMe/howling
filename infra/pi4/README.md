# Howling Home (Raspberry Pi 4)

한 장의 SD 카드에서 Home Assistant와 Howling runtime을 같이 켭니다.

설치와 이미지 쓰기는 [Raspberry Pi 4](../../docs/product/11-raspberry-pi.md)입니다.

```bash
# 이 컴퓨터에서 설치 이미지를 만든다. 결과는 dist/pi4/howling-home-rpi4-64.img.xz
HOWLING_PI_USER=howling HOWLING_PI_PASSWORD='change-me' pnpm image:pi4

# 이미 Raspberry Pi OS가 있는 보드에서는
sudo bash infra/pi4/install.sh
```
