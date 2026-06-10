# Kubernetes deployment (k3s on EC2)

Production manifests live in **`k8s/`**. Deploys use **GitHub Actions** (`.github/workflows/deploy.yml`): a **self-hosted** job on the k3s EC2 node builds, pushes to ECR, and runs `scripts/k3s-apply.sh`.

Local cluster practice uses **`k8s/minikube/`** — see [minikube/README.md](minikube/README.md).

## Layout

| File | Purpose |
|------|---------|
| `namespace.yaml`, `service.yaml` | Shared namespace and ClusterIP service |
| `deployment.yaml` | nginx app (`__IMAGE__` substituted by `k3s-apply.sh`) |
| `ingress.yaml` | Traefik ingress + TLS secret reference |
| `certificate.yaml` | cert-manager Certificate for Let's Encrypt |
| `cert-manager-issuers.yaml` | Let's Encrypt staging/prod ClusterIssuers |
| `ec2-user-data.sh` | EC2 first-boot bootstrap (k3s + AWS CLI) |

Always deploy with **`./scripts/k3s-apply.sh`** — do not `kubectl apply -f k8s/deployment.yaml` directly (image placeholder `__IMAGE__` must be substituted).

## 1. EC2 prerequisites

Launch the instance with **user_data** so AWS CLI and k3s install on first boot:

- Script: [`ec2-user-data.sh`](ec2-user-data.sh)
- In the EC2 launch wizard: **Advanced details → User data** → paste the file contents (or base64 if using the API/CLI).
- Attach an **IAM instance profile** with `AmazonEC2ContainerRegistryReadOnly` (or equivalent ECR read) before first boot so `aws sts get-caller-identity` works in the log.

Check bootstrap:

```bash
sudo tail -f /var/log/severed-head-sunday-user-data.log
aws --version
sudo kubectl get nodes
```

Manual install (if you skipped user_data):

```bash
curl -sfL https://get.k3s.io | sh -
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install
aws sts get-caller-identity
```

Open security-group ports:

| Port | Purpose |
|------|---------|
| 80, 443 | Traefik Ingress |
| 443 (outbound) | Runner ↔ GitHub |

Point DNS `severedheadsunday.band` at the instance public IP.

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

Confirm the runner shows **Idle** in GitHub.

## 3. ECR pull access

k3s does **not** use the EC2 IAM role automatically for **image pulls**. Pods use Kubernetes secret **`ecr-regcred`**, refreshed by `./scripts/k3s-ecr-secret.sh`.

Attach an IAM role with ECR read (and push if the runner builds). The managed policy `AmazonEC2ContainerRegistryReadOnly` works for pulls; add push permissions for CI builds.

```bash
source /etc/profile.d/severed-head-sunday-ecr.sh
./scripts/k3s-ecr-secret.sh

IMAGE=058264155697.dkr.ecr.us-east-1.amazonaws.com/severed-head-sunday-web:v1 \
  ./scripts/k3s-apply.sh
```

Refresh the secret before redeploys (or cron every 6h): `./scripts/k3s-ecr-secret.sh`

## 4. TLS (optional)

One-time on the EC2 node:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml
kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=120s
./scripts/k3s-cert-manager-reset-issuers.sh
```

Each deploy applies [`certificate.yaml`](certificate.yaml) and [`ingress.yaml`](ingress.yaml). The Certificate requests Let's Encrypt via **`letsencrypt-prod`** into secret **`severedheadsunday-tls`**. Test staging first by changing `issuerRef.name` in `certificate.yaml` to `letsencrypt-staging`.

**Remove cert-manager:**

```bash
./scripts/k3s-cert-manager-remove.sh
```

## 5. GitHub repository secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `VITE_MEDIA_BASE_URL` | no | S3/CloudFront base URL baked at build time |
| `VITE_BACKGROUND_IMAGE_URL` | no | Background image URL baked at build time |

Pushes to **`main`** deploy automatically, or use **Actions → Deploy → Run workflow**.

## 6. Verify

```bash
kubectl -n severed-head-sunday get pods,ingress,certificate
curl -H 'Host: severedheadsunday.band' http://127.0.0.1/health
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Deploy job stuck “Waiting for a runner” | Runner offline — `sudo ./svc.sh status`; confirm **Idle** in GitHub |
| `Unable to connect to the server` | Re-copy kubeconfig from `/etc/rancher/k3s/k3s.yaml` |
| `ImagePullBackOff` on ECR | Run `./scripts/k3s-ecr-secret.sh`; confirm IAM ECR role |
| Wrong kubeconfig (EKS) | `scripts/k3s-kubeconfig.sh` rejects EKS endpoints — use local k3s config |
| No Certificate in namespace | Install cert-manager; `kubectl apply -f k8s/cert-manager-issuers.yaml -f k8s/certificate.yaml` |
| Certificate `Ready=False` | Check DNS → this node, port 80 open; `kubectl describe order,challenge -n severed-head-sunday` |
