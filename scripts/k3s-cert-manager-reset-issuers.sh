#!/usr/bin/env bash
# Reset Let's Encrypt ClusterIssuers and force a NEW ACME account (fixes stuck example.com email).
# Run on the k3s EC2 node after editing email in k8s/cert-manager-issuers.yaml.
#
#   ./scripts/k3s-cert-manager-reset-issuers.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/k3s-kubeconfig.sh
source "$ROOT/scripts/k3s-kubeconfig.sh"
k3s_use_kubeconfig

ISSUERS_FILE="$ROOT/k8s/cert-manager-issuers.yaml"

echo "==> Email in file you are about to apply:"
grep 'email:' "$ISSUERS_FILE" || true
echo ""

echo "==> Email currently on ClusterIssuers (if any):"
kubectl get clusterissuer -o custom-columns=NAME:.metadata.name,EMAIL:.spec.acme.email 2>/dev/null || true
echo ""

echo "==> Searching cluster for 'example.com' (secrets / issuers):"
if kubectl get secrets -A -o yaml 2>/dev/null | grep -q 'example.com'; then
  kubectl get secrets -A -o yaml | grep -B5 'example.com' | head -30
else
  echo "  (no 'example.com' in any Secret data — good)"
fi
echo ""

echo "==> Deleting ACME workflow objects (stale Orders can retry old registration)"
kubectl delete clusterissuer --all --ignore-not-found 2>/dev/null || true
kubectl delete certificate --all -A --ignore-not-found 2>/dev/null || true
kubectl delete certificaterequest --all -A --ignore-not-found 2>/dev/null || true
kubectl delete order --all -A --ignore-not-found 2>/dev/null || true
kubectl delete challenge --all -A --ignore-not-found 2>/dev/null || true

echo "==> Deleting ACME account secrets in cert-manager namespace"
for s in letsencrypt-staging letsencrypt-prod \
  letsencrypt-staging-acme-v2 letsencrypt-prod-acme-v2; do
  kubectl delete secret "$s" -n cert-manager --ignore-not-found 2>/dev/null || true
done

echo "==> Restarting cert-manager controller (clears in-memory reconcile state)"
kubectl rollout restart deployment/cert-manager -n cert-manager 2>/dev/null || true
kubectl rollout status deployment/cert-manager -n cert-manager --timeout=120s 2>/dev/null || true

echo "==> Applying ClusterIssuers from repo"
kubectl apply -f "$ISSUERS_FILE"

echo ""
echo "Wait ~30s, then check:"
echo "  kubectl get clusterissuer"
echo "  kubectl describe clusterissuer letsencrypt-staging"
echo ""
echo "EMAIL on live issuer must match your yaml (not example.com):"
echo "  kubectl get clusterissuer letsencrypt-prod -o jsonpath='{.spec.acme.email}{\"\\n\"}'"
