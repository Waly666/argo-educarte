#!/usr/bin/env bash
# Aplica parche nginx Educarte (CSS crítico + skin) y recarga nginx.
# Ejecutar en el VPS: sudo ./deploy/apply-educarte-nginx-inject.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AVAIL="/etc/nginx/sites-available/educartecolombia.com"
SNIP="$ROOT/deploy/nginx/snippets/educarte-portal-inject.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Ejecute con sudo"
  exit 1
fi

if [[ ! -f "$AVAIL" ]]; then
  echo "❌ No existe $AVAIL — ejecute primero setup-educarte-dominio.sh"
  exit 1
fi

if [[ ! -f "$SNIP" ]]; then
  echo "❌ Falta $SNIP — haga git pull en $ROOT"
  exit 1
fi

if ! grep -q 'educarte-portal-inject.conf' "$AVAIL"; then
  echo "==> Insertando include educarte-portal-inject en nginx..."
  sed -i '/location \/ {/a\        include /opt/argo-educarte/deploy/nginx/snippets/educarte-portal-inject.conf;' "$AVAIL"
else
  echo "==> Include educarte-portal-inject ya presente."
fi

nginx -t
systemctl reload nginx
echo "✅ nginx recargado. Compruebe:"
echo "   curl -sI https://educartecolombia.com/ | grep -i x-educarte-portal-inject"
