# Severed Head Sunday — site

React (Vite + TypeScript) single-page app modeled on [severedheadsunday.band](https://severedheadsunday.band/index.html): dark alley backdrop, canvas audio visualizer, playlist, and an on-page **MEMBERS** column (bio panel; audio keeps playing).

## Local development

```bash
npm install
npm run dev
```

Put MP3s in **`public/audio/`** with these exact filenames (same as the original site): `moonrocks.mp3`, `lederhosen.mp3`, `menoevil.mp3`, `ginger.mp3`, `severed_head_sunday.mp3`, `babadooshka.mp3`, `beachday.mp3`, `smother.mp3`, `funkeymother.mp3`. You do **not** need `npm run build` for local dev — Vite serves `public/` as static files during `npm run dev`.

Optional `.env.local` (Git-ignored):

```bash
VITE_MEDIA_BASE_URL=https://your-media-bucket.s3.amazonaws.com/your-prefix
VITE_BACKGROUND_IMAGE_URL=https://your-media-bucket.s3.amazonaws.com/path/alley_background.jpg
```

If `VITE_MEDIA_BASE_URL` is unset, audio URLs resolve to `/audio/<file>.mp3` (place files under `public/audio/`).

## Docker Compose (production-like static server)

```bash
docker compose build --no-cache
docker compose up
```

Images use multi-arch base tags (`node:22-alpine`, `nginxinc/nginx-unprivileged`). On Apple Silicon and other **arm64** hosts, Compose builds a native **linux/arm64** image automatically. The Dockerfile uses BuildKit `BUILDPLATFORM` / `TARGETPLATFORM` so the same file supports cross-platform builds via `./scripts/docker-build.sh` (see EKS below).

Open `http://localhost:8080`.

Build-time variables for the SPA are Docker `build.args` in `docker-compose.yml` (same names as `VITE_*`). Either export them in your shell or copy `.env.example` to `.env` (Compose reads `.env` automatically).

### Optional local “S3” with MinIO

```bash
docker compose --profile s3-local up -d
```

Upload test MP3s using the MinIO console (`http://localhost:9001`), bucket `media`, under `audio/`. Then rebuild the web image with:

```bash
VITE_MEDIA_BASE_URL=http://localhost:9000/media docker compose build web
docker compose up web
```

Browsers require CORS on the bucket for cross-origin audio + Web Audio; configure CORS on AWS S3 or MinIO accordingly.

## Static assets on S3

- **HTML/JS/CSS**: after `npm run build`, use `scripts/sync-static-to-s3.sh` to publish `dist/` (long-cache hashed assets, short-cache `index.html`).
- **Audio / images**: use `scripts/sync-media-to-s3.sh` for bulk uploads to a media bucket; point `VITE_MEDIA_BASE_URL` and `VITE_BACKGROUND_IMAGE_URL` at that bucket or CloudFront.

## Minikube (local Kubernetes practice)

See **[k8s/minikube/README.md](k8s/minikube/README.md)** for a full walkthrough. Quick start:

```bash
minikube start --cpus=2 --memory=4096
./scripts/minikube-deploy.sh
kubectl -n severed-head-sunday port-forward svc/severed-head-sunday-web 8080:80
```

Uses `k8s/minikube/` manifests (local image, NGINX Ingress optional). Production EKS manifests in `k8s/` are unchanged.

## Amazon EKS

1. Build and push the image (replace registry/repo/tag):

   ```bash
   # Native arch (e.g. arm64 laptop → arm64 EKS nodes)
   IMAGE=$REGISTRY/severed-head-sunday-web:v1 \
     VITE_MEDIA_BASE_URL="$VITE_MEDIA_BASE_URL" \
     VITE_BACKGROUND_IMAGE_URL="$VITE_BACKGROUND_IMAGE_URL" \
     ./scripts/docker-build.sh
   docker push $REGISTRY/severed-head-sunday-web:v1

   # Explicit arm64 (from any host with buildx + QEMU)
   PLATFORMS=linux/arm64 IMAGE=$REGISTRY/severed-head-sunday-web:v1 \
     VITE_MEDIA_BASE_URL="$VITE_MEDIA_BASE_URL" \
     VITE_BACKGROUND_IMAGE_URL="$VITE_BACKGROUND_IMAGE_URL" \
     ./scripts/docker-build.sh
   docker push $REGISTRY/severed-head-sunday-web:v1

   # Multi-arch manifest (amd64 + arm64 node pools)
   PLATFORMS=linux/amd64,linux/arm64 PUSH=1 \
     IMAGE=$REGISTRY/severed-head-sunday-web:v1 \
     VITE_MEDIA_BASE_URL="$VITE_MEDIA_BASE_URL" \
     VITE_BACKGROUND_IMAGE_URL="$VITE_BACKGROUND_IMAGE_URL" \
     ./scripts/docker-build.sh
   ```

2. Edit `k8s/deployment.yaml` — set `image:` to your pushed URI.

3. Apply manifests (Ingress annotations assume an AWS ALB-style class; change for your cluster):

   ```bash
   kubectl apply -f k8s/namespace.yaml
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   kubectl apply -f k8s/ingress.yaml
   ```

Tune probes, resources, TLS, and Ingress controller annotations for your environment.

## k3s on EC2 (GitHub Actions)

For a single-node **k3s** cluster on EC2, use the workflow in `.github/workflows/deploy-k3s.yml`. It builds the image, pushes to **GHCR**, and deploys over **SSH** (no public Kubernetes API required).

See **[k8s/k3s/README.md](k8s/k3s/README.md)** for EC2 bootstrap, GitHub secrets (`K3S_HOST`, `K3S_SSH_USER`, `K3S_SSH_PRIVATE_KEY`), and TLS with Traefik.

## Notes

- MP3s are not vendored in this repository; add them under `public/audio/` or host them on S3 and set `VITE_MEDIA_BASE_URL`.
- Rebuild the Docker image whenever `VITE_*` values change — they are inlined at build time.
