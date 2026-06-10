#!/usr/bin/env bash
# Resolve KUBECONFIG for k3s on EC2. Source from other k3s scripts.
#
#   source "$(dirname "$0")/k3s-kubeconfig.sh"
#   k3s_use_kubeconfig
k3s_use_kubeconfig() {
  if [[ -n "${KUBECONFIG:-}" ]]; then
    k3s_warn_if_eks
    return
  fi

  if [[ -r /etc/rancher/k3s/k3s.yaml ]]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    return
  fi

  if [[ -f "${HOME}/.kube/config" ]]; then
    export KUBECONFIG="${HOME}/.kube/config"
    k3s_warn_if_eks
    return
  fi

  echo "error: no kubeconfig found for k3s" >&2
  echo "  sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config" >&2
  echo "  sudo chown \"\$(id -u):\$(id -g)\" ~/.kube/config && chmod 600 ~/.kube/config" >&2
  exit 1
}

k3s_warn_if_eks() {
  local server
  server="$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null || true)"
  if [[ "$server" == *eks.amazonaws.com* ]]; then
    echo "error: kubeconfig points to EKS, not local k3s:" >&2
    echo "  $server" >&2
    echo "" >&2
    echo "Fix on this EC2 node:" >&2
    echo "  sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config" >&2
    echo "  sudo chown \"\$(id -u):\$(id -g)\" ~/.kube/config && chmod 600 ~/.kube/config" >&2
    echo "  unset KUBECONFIG   # or: export KUBECONFIG=~/.kube/config" >&2
    exit 1
  fi
}
