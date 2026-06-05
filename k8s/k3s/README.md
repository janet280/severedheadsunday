# k3s on a single EC2 instance

Deploys use **GitHub Actions** (`.github/workflows/deploy-k3s.yml`):

1. **build** (GitHub-hosted): build image → push to GHCR  
2. **deploy** (self-hosted runner on the k3s EC2 node): `kubectl apply` via `scripts/k3s-apply.sh`

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

The **deploy** job runs on a runner with labels `self-hosted` and `k3s` on this EC2 instance. Register the runner manually via **Settings → Actions → Runners → New self-hosted runner** (add the `k3s` label during setup).

Give the runner user kubectl access:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$(id -u):$(id -g)" ~/.kube/config
chmod 600 ~/.kube/config
```

The deploy step uses `$HOME/.kube/config` automatically (`scripts/k3s-apply.sh`).

Confirm the runner is **Idle** in GitHub with labels `self-hosted`, `linux`, `k3s`.

## 3. GHCR pull access (private repos)

If the GitHub repo/package is **private**, create a pull secret on the cluster once (PAT needs `read:packages`):

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

kubectl -n severed-head-sunday create secret docker-registry ghcr-regcred \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USER \
  --docker-password=YOUR_PAT

# Uncomment imagePullSecrets in k8s/k3s/deployment.yaml, then re-apply.
```

Public repos can skip this step.

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
| Deploy job stuck “Waiting for a runner” | Runner offline or missing `k3s` label — check `sudo ./svc.sh status` |
| `Unable to connect to the server` | Re-copy kubeconfig: `sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && chmod 600 ~/.kube/config` |
| `ImagePullBackOff` on private repo | Add `ghcr-regcred` secret and uncomment `imagePullSecrets` in deployment |
| Wrong kubeconfig path | Ensure `~/.kube/config` exists for the runner user (copy `k3s.yaml` manually) |
