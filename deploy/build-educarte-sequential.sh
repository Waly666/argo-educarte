#!/usr/bin/env bash
# Build secuencial Educarte (VPS con poca RAM).
set -euo pipefail
cd "$(dirname "$0")/.."
C="docker compose -f docker-compose.educarte.yml"

echo "==> Backend..." && $C build argo-backend
echo "==> ERP..." && $C build argo-frontend
echo "==> Aula..." && $C build argo-aula-virtual
echo "==> Up..." && $C up -d --force-recreate --remove-orphans
$C ps
curl -sf http://127.0.0.1:5002/api/health && echo " API OK" || echo " API pendiente"
