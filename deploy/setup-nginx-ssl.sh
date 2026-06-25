#!/bin/bash
# Nginx + Let's Encrypt para finstruvial.edu.co y app.finstruvial.edu.co
# Ejecutar en el VPS como root, desde /opt/argo después de git pull.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_AVAIL="/etc/nginx/sites-available"
NGINX_EN="/etc/nginx/sites-enabled"

echo "==> Comprobando DNS (deben resolver a este servidor)..."
THIS_IP="$(curl -4 -sf ifconfig.me || hostname -I | awk '{print $1}')"
for h in finstruvial.edu.co app.finstruvial.edu.co; do
  RES="$(getent ahostsv4 "$h" 2>/dev/null | awk '{print $1; exit}' || true)"
  if [[ -z "$RES" ]]; then
    echo "ERROR: $h no tiene registro A IPv4. Corrige DNS antes de continuar."
    exit 1
  fi
  if [[ "$RES" != "$THIS_IP" ]]; then
    echo "ERROR: $h → $RES pero este VPS es $THIS_IP"
    echo "       (app.finstruvial.edu.co suele quedar en Hostinger si no cambias el registro A)"
    exit 1
  fi
  echo "  OK $h → $RES"
done

echo "==> Instalando sitios nginx..."
cp "$ROOT/deploy/nginx/finstruvial.edu.co.conf" "$NGINX_AVAIL/finstruvial.edu.co"
cp "$ROOT/deploy/nginx/app.finstruvial.edu.co.conf" "$NGINX_AVAIL/app.finstruvial.edu.co"
ln -sf "$NGINX_AVAIL/finstruvial.edu.co" "$NGINX_EN/finstruvial.edu.co"
ln -sf "$NGINX_AVAIL/app.finstruvial.edu.co" "$NGINX_EN/app.finstruvial.edu.co"

nginx -t
systemctl reload nginx

echo "==> Certificados SSL (Certbot)..."
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

certbot --nginx \
  -d finstruvial.edu.co \
  -d www.finstruvial.edu.co \
  -d app.finstruvial.edu.co \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --redirect || certbot --nginx \
  -d finstruvial.edu.co \
  -d www.finstruvial.edu.co \
  -d app.finstruvial.edu.co

echo "==> Actualizar deploy/.env (CORS + PUBLIC_URL) y reiniciar backend:"
cat <<'ENVHINT'

  nano /opt/argo/deploy/.env

  CORS_ORIGIN=https://app.finstruvial.edu.co,https://finstruvial.edu.co,https://www.finstruvial.edu.co
  PUBLIC_URL=
  # PUBLIC_URL vacío: URLs de uploads usan el dominio de cada petición (recomendado)

  cd /opt/argo && docker compose restart argo-backend

ENVHINT

echo "==> Pruebas:"
curl -sfI "https://finstruvial.edu.co/" | head -1 || true
curl -sfI "https://app.finstruvial.edu.co/" | head -1 || true
curl -sf "https://app.finstruvial.edu.co/api/health" && echo || true

echo "Listo."
