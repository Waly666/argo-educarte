#!/usr/bin/env bash
# Rebuild portal Educarte sin caché + plantilla MongoDB + verificación local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.educarte.yml)
BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

export PORTAL_BUILD_ID="$BUILD_ID"

echo "==> Git: $(git log -1 --oneline 2>/dev/null || echo '?')"
echo "==> PORTAL_BUILD_ID=${PORTAL_BUILD_ID}"

echo "==> Build portal (sin caché)..."
"${COMPOSE[@]}" build --no-cache --pull argo-aula-virtual

echo "==> Recrear contenedor portal..."
"${COMPOSE[@]}" up -d --force-recreate argo-aula-virtual

sleep 2
chmod +x deploy/verify-educarte-portal.sh
./deploy/verify-educarte-portal.sh "http://127.0.0.1:8085" "$BUILD_ID"

echo ""
echo "==> Plantilla Educarte en MongoDB..."
sleep 2
"${COMPOSE[@]}" exec -T argo-backend node scripts/aplicarPlantillaEducartePortal.js

echo ""
echo "Listo. Si usa Cloudflare, purgue caché: Caching → Purge Everything"
echo "Luego abra https://educartecolombia.com/portal-build-marker.txt — debe mostrar: ${BUILD_ID}"
echo ""
if [[ "$(id -u)" -eq 0 ]] && [[ -f /etc/nginx/sites-available/educartecolombia.com ]]; then
  "$ROOT/deploy/apply-educarte-nginx-inject.sh" || true
else
  echo "Parche nginx (mejora inmediata del tema): sudo ./deploy/apply-educarte-nginx-inject.sh"
fi
