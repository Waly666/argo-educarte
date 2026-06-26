#!/usr/bin/env bash
# Educarte — nginx + Let's Encrypt para educartecolombia.com y app.educartecolombia.com
# Ejecutar en el VPS como root, desde /opt/argo-educarte después de git pull.
#
# Requisitos previos:
#   - Docker Educarte corriendo (8083 ERP, 8085 aula)
#   - DNS A → IP del VPS: educartecolombia.com, www, app
#
# Uso: sudo ./deploy/setup-educarte-dominio.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_AVAIL="/etc/nginx/sites-available"
NGINX_EN="/etc/nginx/sites-enabled"
COMPOSE=(docker compose -f docker-compose.educarte.yml)

PORTAL_DOMAIN="educartecolombia.com"
ERP_DOMAIN="app.educartecolombia.com"
HOSTS=("$PORTAL_DOMAIN" "www.$PORTAL_DOMAIN" "$ERP_DOMAIN")

echo "==> Comprobando DNS (deben resolver a este VPS)..."
THIS_IP="$(curl -4 -sf ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
for h in "${HOSTS[@]}"; do
  RES="$(getent ahostsv4 "$h" 2>/dev/null | awk '{print $1; exit}' || true)"
  if [[ -z "$RES" ]]; then
    echo "ERROR: $h no tiene registro A IPv4. Configure DNS en Hostinger y espere propagación."
    exit 1
  fi
  if [[ "$RES" != "$THIS_IP" ]]; then
    echo "ERROR: $h → $RES pero este VPS es $THIS_IP"
    exit 1
  fi
  echo "  OK $h → $RES"
done

echo ""
echo "==> Instalando nginx (si falta)..."
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx
fi

echo "==> Copiando sitios Educarte..."
cp "$ROOT/deploy/nginx/educartecolombia.com.conf" "$NGINX_AVAIL/educartecolombia.com"
cp "$ROOT/deploy/nginx/app.educartecolombia.com.conf" "$NGINX_AVAIL/app.educartecolombia.com"
ln -sf "$NGINX_AVAIL/educartecolombia.com" "$NGINX_EN/educartecolombia.com"
ln -sf "$NGINX_AVAIL/app.educartecolombia.com" "$NGINX_EN/app.educartecolombia.com"

nginx -t
systemctl reload nginx

echo ""
echo "==> Certificados SSL (Certbot)..."
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

certbot --nginx \
  -d "$PORTAL_DOMAIN" \
  -d "www.$PORTAL_DOMAIN" \
  -d "$ERP_DOMAIN" \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --redirect 2>/dev/null || certbot --nginx \
  -d "$PORTAL_DOMAIN" \
  -d "www.$PORTAL_DOMAIN" \
  -d "$ERP_DOMAIN"

ENV_FILE="$ROOT/deploy/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo ""
  echo "==> Actualizando deploy/.env (CORS + portal)..."
  cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
  grep -v '^PORTAL_SITE_URL=' "$ENV_FILE" | grep -v '^CORS_ORIGIN=' | grep -v '^PUBLIC_URL=' | grep -v '^TRUST_PROXY=' > "$ENV_FILE.new" || true
  {
    cat "$ENV_FILE.new"
    echo "TRUST_PROXY=1"
    echo "PUBLIC_URL="
    echo "PORTAL_SITE_URL=https://${PORTAL_DOMAIN}"
    echo "CORS_ORIGIN=https://${ERP_DOMAIN},https://${PORTAL_DOMAIN},https://www.${PORTAL_DOMAIN}"
  } > "$ENV_FILE"
  rm -f "$ENV_FILE.new"
  chmod 600 "$ENV_FILE" 2>/dev/null || true

  echo "==> Recargando backend..."
  cd "$ROOT"
  "${COMPOSE[@]}" up -d --force-recreate argo-backend
fi

echo ""
echo "==> Pruebas HTTPS..."
curl -sfI "https://${PORTAL_DOMAIN}/" | head -1 || true
curl -sfI "https://${ERP_DOMAIN}/login" | head -1 || true
curl -sf "https://${ERP_DOMAIN}/api/health" && echo " API OK" || echo " API pendiente — revise docker compose ps"

cat <<EOF

======================================================================
 Dominio Educarte — siguiente paso (seguridad)
======================================================================
  Portal:  https://${PORTAL_DOMAIN}
  ERP:     https://${ERP_DOMAIN}

  Cuando confirme que HTTPS funciona:

  1. Cerrar puertos Docker al público (solo 22, 80, 443):
     sudo ./deploy/setup-firewall-argo.sh

  2. Respaldos cifrados — en deploy/.env:
     BACKUP_CLAVE_CIFRADO=\$(openssl rand -hex 32)
     (guarde la clave fuera del VPS)

  3. Turnstile (Cloudflare) — deploy/SEGURIDAD-FASE1.md

  4. Activar 2FA staff — MFA_STAFF_REQUIRED=1
     (deploy/SEGURIDAD-FASE3-MFA.md)

  5. App móvil: regenere APK con
     EXPO_PUBLIC_API_BASE_URL=https://${ERP_DOMAIN}/api

======================================================================
EOF

echo "Listo."
