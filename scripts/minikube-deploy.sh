#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${IMAGE:-severed-head-sunday-web:local}"

echo "==> Minikube status"
minikube status

echo "==> Building image inside Minikube Docker: $IMAGE"
eval "$(minikube docker-env)"
docker build -t "$IMAGE" \
  --build-arg VITE_MEDIA_BASE_URL="${VITE_MEDIA_BASE_URL:-}" \
  --build-arg VITE_BACKGROUND_IMAGE_URL="${VITE_BACKGROUND_IMAGE_URL:-}" \
  .

echo "==> Applying manifests"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/minikube/deployment.yaml

echo "==> Waiting for rollout"
kubectl -n severed-head-sunday rollout status deployment/severed-head-sunday-web --timeout=120s

echo ""
echo "Done. Open the site with:"
echo "  kubectl -n severed-head-sunday port-forward svc/severed-head-sunday-web 8080:80"
echo "  → http://localhost:8080"
echo ""
echo "Ingress (optional): minikube addons enable ingress && kubectl apply -f k8s/minikube/ingress.yaml"
echo "See k8s/minikube/README.md"
