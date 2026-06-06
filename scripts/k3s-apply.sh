#!/usr/bin/env bash
# Apply k3s manifests. Run on the EC2 node (KUBECONFIG=/etc/rancher/k3s/k3s.yaml).
#
#   IMAGE=ghcr.io/owner/severed-head-sunday-web:abc123 ./scripts/k3s-apply.sh
#   ./scripts/k3s-apply.sh 058264155697.dkr.ecr.us-east-1.amazonaws.com/severed-head-sunday-web:v1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${IMAGE:-${1:-}}"
IMAGE="${IMAGE:?Set IMAGE env var or pass the full registry URI as the first argument}"

# shellcheck source=scripts/k3s-kubeconfig.sh
source "$ROOT/scripts/k3s-kubeconfig.sh"
k3s_use_kubeconfig

echo "==> Ensuring namespace severed-head-sunday"
kubectl apply -f k8s/namespace.yaml
kubectl wait --for=jsonpath='{.status.phase}'=Active namespace/severed-head-sunday --timeout=30s

echo "==> Applying manifests"
kubectl apply -f k8s/service.yaml
sed "s|__IMAGE__|${IMAGE}|g" k8s/k3s/deployment.yaml | kubectl apply -f -
kubectl apply -f k8s/k3s/ingress.yaml

if ! kubectl -n severed-head-sunday rollout status deployment/severed-head-sunday-web --timeout=180s; then
  echo ""
  echo "==> Rollout timed out. Diagnostics:"
  kubectl -n severed-head-sunday get pods -o wide
  echo ""
  kubectl -n severed-head-sunday describe pods -l app.kubernetes.io/name=severed-head-sunday-web | tail -50
  echo ""
  kubectl -n severed-head-sunday get events --sort-by='.lastTimestamp' | tail -15
  exit 1
fi

echo "Deployed $IMAGE"
