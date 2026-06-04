#!/usr/bin/env bash
# Build the web image for the host architecture, or use buildx when PLATFORMS is set.
#
# Native (Apple Silicon, Minikube on arm64, etc.):
#   ./scripts/docker-build.sh
#   IMAGE=severed-head-sunday-web:local ./scripts/docker-build.sh
#
# Single platform via buildx (e.g. Graviton / arm64 EKS):
#   PLATFORMS=linux/arm64 IMAGE=$REGISTRY/severed-head-sunday-web:v1 ./scripts/docker-build.sh
#
# Multi-arch registry push:
#   PLATFORMS=linux/amd64,linux/arm64 PUSH=1 IMAGE=$REGISTRY/severed-head-sunday-web:v1 ./scripts/docker-build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${IMAGE:-severed-head-sunday-web:local}"
PLATFORMS="${PLATFORMS:-}"
PUSH="${PUSH:-0}"

build_args=(
  --build-arg "VITE_MEDIA_BASE_URL=${VITE_MEDIA_BASE_URL:-}"
  --build-arg "VITE_BACKGROUND_IMAGE_URL=${VITE_BACKGROUND_IMAGE_URL:-}"
)

if [[ -z "$PLATFORMS" ]]; then
  exec docker build -t "$IMAGE" "${build_args[@]}" .
fi

if ! docker buildx version &>/dev/null; then
  echo "error: PLATFORMS=$PLATFORMS requires docker buildx" >&2
  exit 1
fi

if ! docker buildx inspect multiarch &>/dev/null; then
  docker buildx create --name multiarch --driver docker-container --use
  docker buildx inspect --bootstrap
elif ! docker buildx ls 2>/dev/null | awk '/\*/ {print $1}' | grep -qx 'multiarch'; then
  docker buildx use multiarch
fi

extra=()
if [[ "$PUSH" == "1" ]]; then
  extra+=(--push)
elif [[ "$PLATFORMS" != *","* ]]; then
  extra+=(--load)
else
  echo "error: multi-platform build requires PUSH=1 (PLATFORMS=$PLATFORMS)" >&2
  exit 1
fi

docker buildx build \
  --platform "$PLATFORMS" \
  "${extra[@]}" \
  -t "$IMAGE" \
  "${build_args[@]}" \
  .
