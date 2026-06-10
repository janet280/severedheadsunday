#!/usr/bin/env bash
# Remove cert-manager and Let's Encrypt resources from k3s.
# Run on the EC2 node with kubeconfig (same as k3s-apply.sh).
#
#   ./scripts/k3s-cert-manager-remove.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/k3s-kubeconfig.sh
source "$ROOT/scripts/k3s-kubeconfig.sh"
k3s_use_kubeconfig

CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.16.2}"
CERT_MANAGER_MANIFEST="https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"

echo "==> Removing cert-manager annotation/TLS from Ingress"
kubectl annotate ingress severed-head-sunday-web \
  -n severed-head-sunday \
  cert-manager.io/cluster-issuer- 2>/dev/null || true

# Patch to HTTP-only (repo ingress enables TLS when cert-manager is installed)
kubectl patch ingress severed-head-sunday-web -n severed-head-sunday --type=json \
  -p='[{"op": "remove", "path": "/spec/tls"}]' 2>/dev/null || true

echo "==> Deleting ClusterIssuers and app TLS resources"
kubectl delete -f "$ROOT/k8s/k3s/certificate.yaml" --ignore-not-found
kubectl delete -f "$ROOT/k8s/k3s/cert-manager-issuers.yaml" --ignore-not-found
kubectl delete certificate --all -n severed-head-sunday --ignore-not-found
kubectl delete certificaterequest --all -n severed-head-sunday --ignore-not-found
kubectl delete order --all -n severed-head-sunday --ignore-not-found
kubectl delete challenge --all -n severed-head-sunday --ignore-not-found
kubectl delete secret severedheadsunday-tls -n severed-head-sunday --ignore-not-found

echo "==> Deleting ACME account secrets (old example.com email lives here)"
kubectl delete secret letsencrypt-staging letsencrypt-prod \
  letsencrypt-staging-acme-v2 letsencrypt-prod-acme-v2 -n cert-manager --ignore-not-found 2>/dev/null || true
kubectl delete secret -n cert-manager -l cert-manager.io/certificate-name --ignore-not-found 2>/dev/null || true

echo "==> Uninstalling cert-manager"
kubectl delete -f "$CERT_MANAGER_MANIFEST" --ignore-not-found

echo ""
echo "Done. Verify:"
echo "  kubectl get pods -n cert-manager          # should be NotFound / empty"
echo "  kubectl get clusterissuer                 # none"
echo "  curl -I http://severedheadsunday.band/    # HTTP still works"
