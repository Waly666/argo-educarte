#!/usr/bin/env bash
# Build + up del stack Educarte por IP (mongo, backend, ERP, portal).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.educarte.yml)

if [[ ! -f deploy/.env ]]; then
  echo "❌ Falta deploy/.env"
  echo "   Ejecute: ./deploy/setup-educarte-ip-env.sh SU_IP_PUBLICA"
  exit 1
fi

mkdir -p data/uploads data/backups apk

BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
export PORTAL_BUILD_ID="$BUILD_ID"
echo "==> Commit desplegado: $(git log -1 --oneline 2>/dev/null || echo '?')"
echo "==> PORTAL_BUILD_ID=${PORTAL_BUILD_ID}"

echo "==> Backend..."
"${COMPOSE[@]}" build argo-backend

echo "==> ERP (frontend)..."
"${COMPOSE[@]}" build argo-frontend

echo "==> Portal aula virtual (sin caché Docker)..."
"${COMPOSE[@]}" build --no-cache argo-aula-virtual

echo "==> Levantando servicios..."
"${COMPOSE[@]}" up -d --force-recreate --remove-orphans

echo ""
echo "==> Estado:"
"${COMPOSE[@]}" ps

echo ""
echo -n "==> Health API: "
if curl -sf http://127.0.0.1:5002/api/health >/dev/null; then
  echo "OK"
else
  echo "pendiente — revise: docker compose -f docker-compose.educarte.yml logs argo-backend --tail 50"
fi

echo ""
echo "==> Plantilla Educarte (tema + landing en MongoDB)..."
sleep 3
if "${COMPOSE[@]}" exec -T argo-backend node scripts/aplicarPlantillaEducartePortal.js; then
  echo "    OK — portal servirá skin Educarte sin cambios manuales en el ERP."
else
  echo "    ⚠ No se pudo aplicar — reintente cuando Mongo esté listo:"
  echo "    docker compose -f docker-compose.educarte.yml exec -T argo-backend node scripts/aplicarPlantillaEducartePortal.js"
fi

echo ""
echo "==> Verificación portal local (:8085)..."
chmod +x deploy/verify-educarte-portal.sh
if ./deploy/verify-educarte-portal.sh "http://127.0.0.1:8085" "$BUILD_ID"; then
  echo "    Si usa dominio + Cloudflare: purgue caché y compruebe"
  echo "    https://educartecolombia.com/portal-build-marker.txt → debe ser ${BUILD_ID}"
else
  echo "    ⚠ Verificación falló — el contenedor no sirve el build Educarte."
  exit 1
fi

VPS_IP="$(grep '^PORTAL_SITE_URL=' deploy/.env | sed -E 's|^PORTAL_SITE_URL=http://([^:/]+).*|\1|')"
if [[ -n "$VPS_IP" ]]; then
  echo ""
  echo "Acceso:"
  echo "  ERP:          http://${VPS_IP}:8083"
  echo "  Aula virtual: http://${VPS_IP}:8085"
fi
