# 동일 runtime build. e2e Dockerfile.apps 의 runtime stage를 감싼다.
ARG RUNTIME_IMAGE=howling-runtime:local
FROM ${RUNTIME_IMAGE}
ENV RUNTIME_HOST=0.0.0.0
ENV RUNTIME_PORT=4000
ENV RUNTIME_SECRET_ROOT=/data
ENV RUNTIME_SQLITE_PATH=/data/runtime.sqlite
WORKDIR /app
CMD ["node", "apps/runtime/dist/main.js"]
