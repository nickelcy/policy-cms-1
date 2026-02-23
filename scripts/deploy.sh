#!/usr/bin/env bash
set -euo pipefail

echo "[1/3] Building frontend..."
npm run build

echo "[2/3] Restarting policy-cms-web service..."
docker compose up -d --force-recreate policy-cms-web

echo "[3/3] Checking local health endpoint..."
curl -fsSI http://127.0.0.1:8088 >/dev/null

echo "Deployment complete: http://127.0.0.1:8088"
