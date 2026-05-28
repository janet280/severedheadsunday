# Run on Minikube (local Kubernetes learning)

Use this on the same machine as development. **AWS ALB Ingress does not work on Minikube** — these manifests use a **local Docker image** and optional **NGINX Ingress** (or `port-forward`).

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- Docker (Minikube driver `docker` is easiest on Mac)

```bash
minikube version
kubectl version --client
```

## 1. Start the cluster

```bash
minikube start --cpus=2 --memory=4096
```

(`4096` MB helps if your image includes `public/audio/`.)

## 2. Build the image *inside* Minikube's Docker

So Kubernetes can use `imagePullPolicy: Never` without ECR:

```bash
eval $(minikube docker-env)
docker build -t severed-head-sunday-web:local .
```

Optional media URLs at build time (same as production):

```bash
docker build -t severed-head-sunday-web:local \
  --build-arg VITE_MEDIA_BASE_URL="" \
  --build-arg VITE_BACKGROUND_IMAGE_URL="" \
  .
```

To use your **normal** Docker again later:

```bash
eval $(minikube docker-env -u)
```

**Alternative:** build on host, then `minikube image load severed-head-sunday-web:local`

## 3. Deploy

From the **repo root**:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/minikube/deployment.yaml
```

Wait for the pod:

```bash
kubectl -n severed-head-sunday get pods
kubectl -n severed-head-sunday wait --for=condition=ready pod -l app.kubernetes.io/name=severed-head-sunday-web --timeout=120s
```

## 4. Open the site

### Option A — Port forward (simplest)

```bash
kubectl -n severed-head-sunday port-forward svc/severed-head-sunday-web 8080:80
```

Open **http://localhost:8080**

### Option B — Ingress (practice Ingress objects)

```bash
minikube addons enable ingress
kubectl apply -f k8s/minikube/ingress.yaml
```

Get Minikube IP and add a hosts entry:

```bash
minikube ip
# e.g. 192.168.49.2
```

```text
# /etc/hosts
192.168.49.2 severedheadsunday.test
```

Open **http://severedheadsunday.test**

Check Ingress:

```bash
kubectl -n severed-head-sunday get ingress
```

### If `severedheadsunday.test` does not open (Mac / Docker driver)

`/etc/hosts` is not enough by itself. The Ingress **ADDRESS** (e.g. `192.168.49.2`) is often **not reachable** from the Mac until you run a tunnel.

**Fix A — `minikube tunnel` (for Ingress hostname)**

In a **separate terminal**, leave this running (may ask for your Mac password):

```bash
minikube tunnel
```

Then open **http://severedheadsunday.test** again.

**Fix B — Port forward (simplest, no tunnel)**

```bash
kubectl -n severed-head-sunday port-forward svc/severed-head-sunday-web 8080:80
```

Open **http://localhost:8080** (no `/etc/hosts` needed).

**Fix C — Optional: ingress-dns addon**

```bash
minikube addons enable ingress-dns
```

Helps some setups resolve `*.test` names; you may still need **Fix A** on Mac.

**Verify**

```bash
minikube ip
grep severedheadsunday /etc/hosts
kubectl -n severed-head-sunday get ingress
# After tunnel, should return HTML:
curl -I -H "Host: severedheadsunday.test" http://$(minikube ip)/
```

## Useful learning commands

```bash
# What is running?
kubectl -n severed-head-sunday get all

# Pod logs
kubectl -n severed-head-sunday logs -l app.kubernetes.io/name=severed-head-sunday-web

# Why not healthy?
kubectl -n severed-head-sunday describe pod -l app.kubernetes.io/name=severed-head-sunday-web

# Shell into nginx container
kubectl -n severed-head-sunday exec -it deploy/severed-head-sunday-web -- sh

# Hit health from inside cluster
kubectl -n severed-head-sunday run curl --rm -it --image=curlimages/curl -- \
  curl -s http://severed-head-sunday-web/health
```

## After code changes

```bash
eval $(minikube docker-env)
docker build -t severed-head-sunday-web:local .
kubectl -n severed-head-sunday rollout restart deployment/severed-head-sunday-web
kubectl -n severed-head-sunday rollout status deployment/severed-head-sunday-web
```

## Teardown

```bash
kubectl delete namespace severed-head-sunday
# or
minikube delete
```

## Minikube vs AWS EKS (this repo)

| Topic | Minikube | EKS |
|--------|----------|-----|
| Ingress | `ingressClassName: nginx` | `alb` + ALB annotations |
| Image | `severed-head-sunday-web:local`, `Never` | ECR URI, `Always` |
| Replicas | `1` in `k8s/minikube/deployment.yaml` | `2` in `k8s/deployment.yaml` |
| DNS | `localhost` or `/etc/hosts` | Route 53 → ALB |

Production manifests stay in `k8s/` (not `k8s/minikube/`).
