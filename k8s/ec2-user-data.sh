#!/bin/bash
# EC2 launch template / instance user_data (paste as plain text, or base64-encode for API).
# Installs AWS CLI v2, k3s, and common deps for deploy.yml + k3s-ecr-secret.sh.
set -euo pipefail
exec > >(tee /var/log/severed-head-sunday-user-data.log) 2>&1

echo "==> user_data start $(date -Is)"

# ECR settings for scripts/k3s-ecr-secret.sh and deploy.yml (no access keys here).
# Auth uses the EC2 instance IAM role via the AWS CLI credential chain.
ECR_REGISTRY="${ECR_REGISTRY:-058264155697.dkr.ecr.us-east-1.amazonaws.com}"
AWS_REGION="${AWS_REGION:-us-east-1}"

write_ecr_env() {
  echo "==> Writing ECR env to /etc/profile.d/severed-head-sunday-ecr.sh"
  cat >/etc/profile.d/severed-head-sunday-ecr.sh <<EOF
# Severed Head Sunday — ECR region/registry (auth via instance IAM role)
export AWS_REGION=${AWS_REGION}
export AWS_DEFAULT_REGION=${AWS_REGION}
export ECR_REGISTRY=${ECR_REGISTRY}
EOF
  chmod 644 /etc/profile.d/severed-head-sunday-ecr.sh
  # Non-interactive shells (cron, some CI steps)
  grep -q '^AWS_REGION=' /etc/environment 2>/dev/null || {
    echo "AWS_REGION=${AWS_REGION}" >>/etc/environment
    echo "AWS_DEFAULT_REGION=${AWS_REGION}" >>/etc/environment
    echo "ECR_REGISTRY=${ECR_REGISTRY}" >>/etc/environment
  }
}

write_ecr_env

install_aws_cli() {
  if command -v aws &>/dev/null; then
    echo "==> AWS CLI already installed: $(aws --version 2>&1 || true)"
    return 0
  fi

  echo "==> Installing AWS CLI v2"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64) AWSCLI_ARCH="x86_64" ;;
    aarch64|arm64) AWSCLI_ARCH="aarch64" ;;
    *)
      echo "error: unsupported arch for AWS CLI: $ARCH" >&2
      exit 1
      ;;
  esac

  if command -v dnf &>/dev/null; then
    dnf install -y unzip curl
  elif command -v yum &>/dev/null; then
    yum install -y unzip curl
  elif command -v apt-get &>/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y unzip curl ca-certificates
  fi

  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWSCLI_ARCH}.zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install --update
  rm -rf /tmp/aws /tmp/awscliv2.zip

  aws --version
  aws sts get-caller-identity || echo "warn: sts failed (attach IAM role with ECR read?)"
}

install_k3s() {
  if command -v k3s &>/dev/null; then
    echo "==> k3s already installed"
    return 0
  fi

  echo "==> Installing k3s"
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644" sh -
  k3s kubectl get nodes
}

install_aws_cli
install_k3s

echo "==> user_data complete $(date -Is)"
