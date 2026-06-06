# k3s on a single EC2 instance

Deploys use **GitHub Actions** (`.github/workflows/deploy-k3s.yml`): a single **self-hosted** job on the k3s EC2 node builds, pushes to ECR, and runs `scripts/k3s-apply.sh`.

Production EKS manifests stay in `k8s/`; these files are for **k3s + Traefik** on EC2.

## 1. EC2 prerequisites

On the instance (Ubuntu 22.04/24.04 or Amazon Linux 2023):

```bash
# Install k3s (single-node)
curl -sfL https://get.k3s.io | sh -

# Confirm
sudo kubectl get nodes
```

Open security-group ports as needed:

| Port | Purpose |
|------|---------|
| 80, 443 | Traefik Ingress |
| 443 (outbound) | Runner ↔ GitHub |

Point DNS `severedheadsunday.band` at the instance public IP (or a load balancer in front of it).

## 2. Self-hosted GitHub runner

The workflow uses `runs-on: self-hosted`. Register a runner on this EC2 instance via **Settings → Actions → Runners → New self-hosted runner**.

Give the runner user kubectl access:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$(id -u):$(id -g)" ~/.kube/config
chmod 600 ~/.kube/config
```

Install and start the runner service (from the runner install directory):

```bash
sudo ./svc.sh install ubuntu    # use your runner user
sudo ./svc.sh start
sudo ./svc.sh status
```

Confirm the runner shows **Idle** in GitHub (green dot). If the job sits at “Waiting for a runner…”, the runner is offline, registered to the wrong repo/org, or missing the `self-hosted` label.

## 3. ECR pull access (required for private ECR)

k3s does **not** use the EC2 IAM role automatically for image pulls. Create a Kubernetes pull secret once (then refresh every ~12 hours, or add a cron job):

**1. Attach an IAM role to the EC2 instance** with at least:

- `ecr:GetAuthorizationToken` (resource `*`)
- `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchCheckLayerAvailability` (on your repo or `*`)

The managed policy `AmazonEC2ContainerRegistryReadOnly` works.

**2. Install AWS CLI on the EC2 node** (uses the instance role — no access keys needed):

```bash
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
sudo /tmp/aws/install
aws sts get-caller-identity   # should show the instance role
```

**3. Create the pull secret and redeploy:**

```bash
cd severed-head-sunday-site
./scripts/k3s-ecr-secret.sh

IMAGE=058264155697.dkr.ecr.us-east-1.amazonaws.com/severed-head-sunday-web:v1 \
  ./scripts/k3s-apply.sh
```

Refresh the secret before redeploys (or cron every 6h):

```bash
./scripts/k3s-ecr-secret.sh
```

### GHCR instead of ECR

If CI pushes to GHCR and the package is private, use `ghcr-regcred` instead — swap `imagePullSecrets` in `k8s/k3s/deployment.yaml` and create the secret with a GitHub PAT (`read:packages`).

## 4. TLS (optional)

Install [cert-manager](https://cert-manager.io/docs/installation/) and a Let's Encrypt `ClusterIssuer`, then uncomment the TLS lines in `k8s/k3s/ingress.yaml`.

## 5. GitHub repository secrets

In **Settings → Secrets and variables → Actions**:

| Secret | Required | Description |
|--------|----------|-------------|
| `VITE_MEDIA_BASE_URL` | no | S3/CloudFront base URL baked into the SPA at build time |
| `VITE_BACKGROUND_IMAGE_URL` | no | Background image URL baked at build time |

`GITHUB_TOKEN` is provided automatically for GHCR push. No SSH secrets are required with the self-hosted runner.

After the runner is online, pushes to **`main`** deploy automatically, or use **Actions → Deploy to k3s (EC2) → Run workflow** to test.

## 6. Verify

On the EC2 node:

```bash
export KUBECONFIG=~/.kube/config   # or /etc/rancher/k3s/k3s.yaml as root
kubectl -n severed-head-sunday get pods,ingress
curl -H 'Host: severedheadsunday.band' http://127.0.0.1/health
```

## 7. Local one-off deploy

```bash
IMAGE=ghcr.io/your-org/severed-head-sunday-web:abc123 \
  KUBECONFIG=~/.kube/config \
  ./scripts/k3s-apply.sh
```

Change `BUILD_PLATFORM` in `.github/workflows/deploy-k3s.yml` to `linux/arm64` if the EC2 instance is Graviton.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `namespaces "severed-head-sunday" not found` on `k8s/deployment.yaml` | Do **not** apply `k8s/` or `k8s/deployment.yaml` directly — those are for EKS. Use `./scripts/k3s-apply.sh` or apply `k8s/k3s/` after the namespace exists |
| Deploy job stuck “Waiting for a runner” | Runner offline — `sudo ./svc.sh status` on EC2; confirm **Idle** in GitHub → Settings → Actions → Runners; runner must be registered to **this repo** (or org) with label `self-hosted` |
| `Unable to connect to the server` | Re-copy kubeconfig: `sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && chmod 600 ~/.kube/config` |
| `ImagePullBackOff` / `no basic auth credentials` on ECR | Run `./scripts/k3s-ecr-secret.sh`, ensure EC2 has IAM ECR read role, re-apply deployment |
| `ImagePullBackOff` on GHCR private repo | Add `ghcr-regcred` secret and swap `imagePullSecrets` in deployment |
| Wrong kubeconfig path | Ensure `~/.kube/config` exists for the runner user (copy `k3s.yaml` manually) |
