#!/usr/bin/env bash
set -euo pipefail

# Upload audio and images (e.g. public/audio, alley art) to a dedicated media bucket or prefix.
# Configure CORS on the bucket to allow GET from your site origin if loading cross-origin.
#
# Usage:
#   MEDIA_DIR=./public/audio BUCKET=my-media-bucket ./scripts/sync-media-to-s3.sh
#
# Example CORS (adjust AllowedOrigins):
# [{"AllowedHeaders":["*"],"AllowedMethods":["GET","HEAD"],"AllowedOrigins":["https://your-domain"],"ExposeHeaders":[]}]

MEDIA_DIR="${MEDIA_DIR:?Set MEDIA_DIR to a folder of media files}"
BUCKET="${BUCKET:?Set BUCKET to the media bucket}"
PREFIX="${PREFIX:-audio}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

aws s3 sync "$MEDIA_DIR" "s3://${BUCKET}/${PREFIX}" \
  --region "$REGION" \
  --cache-control "public,max-age=31536000,immutable"

echo "Synced $MEDIA_DIR to s3://${BUCKET}/${PREFIX}"
