#!/usr/bin/env bash
# Create or refresh the Kubernetes pull secret for AWS ECR.
# ECR tokens expire after ~12 hours — re-run before deploys or add a cron job.
#
#   ./scripts/k3s-ecr-secret.sh
#   ECR_REGISTRY=058264155697.dkr.ecr.us-east-1.amazonaws.com AWS_REGION=us-east-1 ./scripts/k3s-ecr-secret.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/k3s-kubeconfig.sh
source "$ROOT/scripts/k3s-kubeconfig.sh"

DEFAULT_ECR_REGISTRY='058264155697.dkr.ecr.us-east-1.amazonaws.com'
ECR_REGISTRY="${ECR_REGISTRY:-$DEFAULT_ECR_REGISTRY}"
AWS_REGION="${AWS_REGION:-us-east-1}"
NAMESPACE="${NAMESPACE:-severed-head-sunday}"
SECRET_NAME="${SECRET_NAME:-ecr-regcred}"

if [[ "$ECR_REGISTRY" != *'.dkr.ecr.'* ]]; then
  echo "error: ECR_REGISTRY must be the full host (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com)" >&2
  echo "  got: $ECR_REGISTRY" >&2
  exit 1
fi

k3s_use_kubeconfig

if ! command -v aws &>/dev/null; then
  echo "error: aws CLI is required (uses the EC2 instance IAM role for auth)" >&2
  echo "  curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-\$(uname -m).zip -o /tmp/awscliv2.zip" >&2
  echo "  unzip -q /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install" >&2
  exit 1
fi

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

ECR_TOKEN="$(aws ecr get-login-password --region "$AWS_REGION")"
kubectl create secret docker-registry "$SECRET_NAME" \
  --docker-server="$ECR_REGISTRY" \
  --docker-username=AWS \
  --docker-password="$ECR_TOKEN" \
  -n "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Updated ${SECRET_NAME} in ${NAMESPACE} (ECR auth expires ~12h — re-run to refresh)"
