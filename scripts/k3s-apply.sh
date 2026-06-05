#!/usr/bin/env bash
# Apply k3s manifests. Run on the EC2 node (KUBECONFIG=/etc/rancher/k3s/k3s.yaml).
#
#   IMAGE=ghcr.io/owner/severed-head-sunday-web:abc123 ./scripts/k3s-apply.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${IMAGE:?Set IMAGE to the full registry URI including tag}"

if [[ -z "${KUBECONFIG:-}" ]]; then
  if [[ -f "${HOME}/.kube/config" ]]; then
    export KUBECONFIG="${HOME}/.kube/config"
  else
    export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"
  fi
fi

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/service.yaml
sed "s|__IMAGE__|${IMAGE}|g" k8s/k3s/deployment.yaml | kubectl apply -f -
kubectl apply -f k8s/k3s/ingress.yaml

kubectl -n severed-head-sunday rollout status deployment/severed-head-sunday-web --timeout=180s

echo "Deployed $IMAGE"
