#!/bin/bash
# Añade orígenes HTTPS de producción a deploy/.env y reinicia el backend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.env"
CORS_LINE='CORS_ORIGIN=https://app.finstruvial.edu.co,https://finstruvial.edu.co,https://www.finstruvial.edu.co'

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE — copia deploy/env.example primero."
  exit 1
fi

if grep -q '^CORS_ORIGIN=' "$ENV_FILE"; then
  sed -i "s|^CORS_ORIGIN=.*|$CORS_LINE|" "$ENV_FILE"
else
  echo "$CORS_LINE" >> "$ENV_FILE"
fi

# PUBLIC_URL vacío = URLs según dominio de cada petición
if grep -q '^PUBLIC_URL=' "$ENV_FILE"; then
  sed -i 's|^PUBLIC_URL=.*|PUBLIC_URL=|' "$ENV_FILE"
else
  echo 'PUBLIC_URL=' >> "$ENV_FILE"
fi

echo "==> CORS actualizado:"
grep '^CORS_ORIGIN=' "$ENV_FILE"

cd "$ROOT"
docker compose restart argo-backend
sleep 2

code="$(curl -s -o /tmp/cors-fix.out -w '%{http_code}' -X OPTIONS \
  -H 'Origin: https://finstruvial.edu.co' \
  -H 'Access-Control-Request-Method: POST' \
  https://finstruvial.edu.co/api/auth/login || true)"
echo "==> Prueba CORS: HTTP $code"
cat /tmp/cors-fix.out; echo
