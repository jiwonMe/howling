# Howling HA OS 앱

Docker runtime과 같은 이미지를 Supervisor addon으로 감쌉니다.

```bash
# 먼저 runtime 이미지를 만든다.
docker build -f infra/e2e/Dockerfile.apps --target runtime -t howling-runtime:local .
docker build -f infra/ha-addon/Dockerfile --build-arg RUNTIME_IMAGE=howling-runtime:local -t howling-addon:local .
```

설치 후 Home Assistant는 `SUPERVISOR_TOKEN`과 `http://supervisor/core`를 씁니다. URL·LLAT를 다시 넣을 필요는 없습니다. Ingress로 `/setup` pairing만 합니다.

`manifest.json`은 protocol / artifact schema / node catalog 버전을 addon version과 같이 기록합니다.
