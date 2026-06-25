#!/bin/bash
# Diagnóstico rápido: dominios ARGO vs infravial en el VPS.
set -euo pipefail

echo "==> DNS / respuesta local"
for h in finstruvial.edu.co www.finstruvial.edu.co app.finstruvial.edu.co infravial.cloud; do
  ip="$(getent ahostsv4 "$h" 2>/dev/null | awk '{print $1; exit}' || true)"
  echo "  $h → ${ip:-sin A}"
done

echo ""
echo "==> Nginx: server_name por sitio"
grep -rh "server_name\|proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^[ \t]*//' || true

echo ""
echo "==> ¿infravial usa finstruvial.edu.co? (no debería)"
grep -r "finstruvial" /etc/nginx/sites-enabled/ 2>/dev/null || echo "  (ninguno en sites-enabled)"

echo ""
echo "==> Contenedores ARGO"
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | grep -E "argo|NAMES" || true

echo ""
echo "==> Título HTML (curl local)"
for pair in "finstruvial.edu.co:8085" "app.finstruvial.edu.co:8083"; do
  host="${pair%%:*}"
  port="${pair##*:}"
  title="$(curl -sf -H "Host: $host" "http://127.0.0.1:$port/" | grep -oi '<title>[^<]*</title>' | head -1 || echo '?')"
  echo "  $host (puerto $port): $title"
done

echo ""
echo "==> CORS en deploy/.env"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/deploy/.env" ]]; then
  grep -E "^CORS_ORIGIN=" "$ROOT/deploy/.env" || echo "  CORS_ORIGIN no definido"
else
  echo "  FALTA $ROOT/deploy/.env"
fi

echo ""
echo "==> Prueba CORS aula (debe ser 204, no 500)"
code="$(curl -s -o /tmp/cors-test.out -w '%{http_code}' -X OPTIONS \
  -H 'Origin: https://finstruvial.edu.co' \
  -H 'Access-Control-Request-Method: POST' \
  https://finstruvial.edu.co/api/auth/login || true)"
echo "  OPTIONS /api/auth/login → HTTP $code"
head -c 200 /tmp/cors-test.out 2>/dev/null; echo

echo ""
echo "Si CORS falla, edita deploy/.env:"
echo "  CORS_ORIGIN=https://app.finstruvial.edu.co,https://finstruvial.edu.co,https://www.finstruvial.edu.co"
echo "  docker compose restart argo-backend"
