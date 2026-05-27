#!/usr/bin/env bash
set -euo pipefail

# Sync built static assets (and optional public/) to an S3 bucket for CloudFront or ALB origin.
# Usage:
#   DIST_DIR=dist BUCKET=my-spa-bucket AWS_REGION=us-east-1 ./scripts/sync-static-to-s3.sh
#
# Requires: aws CLI v2, credentials with s3:PutObject on the bucket/prefix.

DIST_DIR="${DIST_DIR:-dist}"
BUCKET="${BUCKET:?Set BUCKET to the target S3 bucket}"
PREFIX="${PREFIX:-}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "Missing $DIST_DIR — run npm run build first." >&2
  exit 1
fi

if [[ -z "$PREFIX" ]]; then
  DEST="s3://${BUCKET}/"
else
  P="$PREFIX"
  [[ "$P" == */ ]] || P="${P}/"
  DEST="s3://${BUCKET}/${P}"
fi

aws s3 sync "$DIST_DIR" "$DEST" \
  --region "$REGION" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

aws s3 cp "$DIST_DIR/index.html" "${DEST}index.html" \
  --region "$REGION" \
  --cache-control "no-cache"

echo "Synced $DIST_DIR to ${DEST}"
