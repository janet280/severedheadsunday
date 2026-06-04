# k3s on a single EC2 instance

Deploys use **GitHub Actions** (`.github/workflows/deploy-k3s.yml`): build → push to GHCR → SSH to the EC2 node → `kubectl apply`.

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
| 22 | SSH (GitHub Actions deploy) |
| 80, 443 | Traefik Ingress |
| 6443 | Kubernetes API (optional; not required for SSH deploy) |

Point DNS `severedheadsunday.band` at the instance public IP (or a load balancer in front of it).

## 2. GHCR pull access (private repos)

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

## 3. TLS (optional)

Install [cert-manager](https://cert-manager.io/docs/installation/) and a Let's Encrypt `ClusterIssuer`, then uncomment the TLS lines in `k8s/k3s/ingress.yaml`.

## 4. First deploy (manual bootstrap)

Clone the repo on the EC2 node (or copy manifests), build nothing locally—CI pushes the image. For the very first rollout, apply once with any tag (CI will replace it on the next push):

```bash
git clone https://github.com/YOUR_ORG/severed-head-sunday-site.git
cd severed-head-sunday-site

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
IMAGE=ghcr.io/your-org/severed-head-sunday-web:bootstrap ./scripts/k3s-apply.sh
```

Or wait until GitHub Actions has pushed at least one image, then trigger **Actions → Deploy to k3s (EC2) → Run workflow**.

## 5. GitHub repository secrets

In **Settings → Secrets and variables → Actions**:

| Secret | Required | Description |
|--------|----------|-------------|
| `K3S_HOST` | yes | EC2 public IP or hostname |
| `K3S_SSH_USER` | yes | e.g. `ubuntu` or `ec2-user` |
| `K3S_SSH_PRIVATE_KEY` | yes | PEM private key for SSH |
| `VITE_MEDIA_BASE_URL` | no | S3/CloudFront base URL baked into the SPA at build time |
| `VITE_BACKGROUND_IMAGE_URL` | no | Background image URL baked at build time |

`GITHUB_TOKEN` is provided automatically for GHCR push.

After secrets are set, pushes to **`main`** deploy automatically.

## 6. Verify

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl -n severed-head-sunday get pods,ingress
curl -H 'Host: severedheadsunday.band' http://localhost/health
```

## 7. Local one-off deploy

From your laptop (with kubeconfig or SSH):

```bash
IMAGE=ghcr.io/your-org/severed-head-sunday-web:abc123 \
  KUBECONFIG=~/.kube/k3s-ec2.yaml \
  ./scripts/k3s-apply.sh
```

Change `BUILD_PLATFORM` in `.github/workflows/deploy-k3s.yml` to `linux/arm64` if the EC2 instance is Graviton.
