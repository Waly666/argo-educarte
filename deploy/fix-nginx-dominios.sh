#!/bin/bash
# Corrige mezcla finstruvial.edu.co → infravial en nginx del VPS.
# Ejecutar como root: cd /opt/argo && chmod +x deploy/fix-nginx-dominios.sh && ./deploy/fix-nginx-dominios.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_AVAIL="/etc/nginx/sites-available"
NGINX_EN="/etc/nginx/sites-enabled"

echo "==> Diagnóstico (tamaño HTML; aula ~1132 bytes, infravial ~24400)"
for url in "https://finstruvial.edu.co/" "https://infravial.cloud/" "https://finstruvial.edu.co/login"; do
  bytes="$(curl -sf "$url" 2>/dev/null | wc -c || echo 0)"
  title="$(curl -sf "$url" 2>/dev/null | grep -oi '<title>[^<]*</title>' | head -1 || echo '?')"
  echo "  $url → $bytes bytes — $title"
done

echo ""
echo "==> ¿finstruvial en configs de infravial? (no debería)"
grep -rn "finstruvial" /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null || true

echo ""
echo "==> Reinstalar sitios ARGO (aula → 8085, ERP → 8083)"
cp "$ROOT/deploy/nginx/finstruvial.edu.co.conf" "$NGINX_AVAIL/finstruvial.edu.co"
cp "$ROOT/deploy/nginx/app.finstruvial.edu.co.conf" "$NGINX_AVAIL/app.finstruvial.edu.co"
ln -sf "$NGINX_AVAIL/finstruvial.edu.co" "$NGINX_EN/finstruvial.edu.co"
ln -sf "$NGINX_AVAIL/app.finstruvial.edu.co" "$NGINX_EN/app.finstruvial.edu.co"

echo ""
echo "==> Quitar finstruvial.edu.co de configs que NO sean ARGO"
for f in /etc/nginx/sites-available/*; do
  base="$(basename "$f")"
  case "$base" in
    finstruvial.edu.co|app.finstruvial.edu.co) continue ;;
  esac
  if grep -q "finstruvial\.edu\.co" "$f" 2>/dev/null; then
    echo "  Editando $f — quitar finstruvial del server_name"
    sed -i 's/ finstruvial\.edu\.co//g; s/finstruvial\.edu\.co //g; s/www\.finstruvial\.edu\.co//g' "$f"
    sed -i 's/server_name  \+/server_name /g; s/server_name ;/server_name _;/g' "$f"
  fi
done

echo ""
echo "==> SSL (Certbot) — reaplicar certificados a sitios ARGO"
if command -v certbot >/dev/null 2>&1; then
  certbot --nginx \
    -d finstruvial.edu.co \
    -d www.finstruvial.edu.co \
    -d app.finstruvial.edu.co \
    --non-interactive --agree-tos --register-unsafely-without-email \
    --redirect 2>/dev/null || certbot --nginx \
    -d finstruvial.edu.co \
    -d www.finstruvial.edu.co \
    -d app.finstruvial.edu.co
else
  echo "  certbot no instalado — instala SSL manualmente"
fi

nginx -t
systemctl reload nginx

echo ""
echo "==> Verificación final"
curl -sf "https://finstruvial.edu.co/" | grep -oi '<title>[^<]*</title>' | head -1
curl -sf "https://finstruvial.edu.co/" | wc -c | xargs -I{} echo "  finstruvial.edu.co/ → {} bytes (esperado ~1132 aula)"
curl -sf "https://infravial.cloud/" | grep -oi '<title>[^<]*</title>' | head -1

echo ""
echo "Listo. finstruvial.edu.co debe mostrar <title>Aula virtual</title>"
