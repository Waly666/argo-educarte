#!/usr/bin/env bash
# Genera deploy/.env para Educarte desplegado por IP (sin dominio).
# Uso: ./deploy/setup-educarte-ip-env.sh 203.0.113.10
set -euo pipefail

VPS_IP="${1:-}"
if [[ -z "$VPS_IP" ]]; then
  echo "Uso: $0 IP_PUBLICA_DEL_VPS"
  echo "Ejemplo: $0 72.60.175.120"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.env"

if [[ -f "$ENV_FILE" ]]; then
  echo "⚠️  Ya existe deploy/.env — se creará respaldo en deploy/.env.bak"
  cp "$ENV_FILE" "$ENV_FILE.bak"
fi

if command -v openssl >/dev/null 2>&1; then
  JWT_SECRET="$(openssl rand -hex 32)"
else
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
fi

mkdir -p "$ROOT/data/uploads" "$ROOT/data/backups" "$ROOT/apk"

cat > "$ENV_FILE" <<EOF
# Educarte — generado por setup-educarte-ip-env.sh ($(date -Iseconds))
# Fase 1: acceso por IP. Fase 2: dominio + HTTPS (ver deploy/GUIA-DESPLIEGUE-VPS-IP-EDUCARTE.md)

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES=12h
JWT_PORTAL_EXPIRES=7d
PORT=3000
HOST=0.0.0.0
MONGO_URI=mongodb://argo-mongo:27017/argo-educarte
UPLOAD_DIR=uploads
BACKUP_DIR=backups
NODE_ENV=production
TZ=America/Bogota

# Vacío = URLs de uploads/certificados según Host del navegador (nginx :8083 / :8085)
PUBLIC_URL=

# Portal (sitemap); actualizar cuando haya dominio
PORTAL_SITE_URL=http://${VPS_IP}:8085

# Orígenes del ERP y portal (obligatorio en producción por IP)
CORS_ORIGIN=http://${VPS_IP}:8083,http://${VPS_IP}:8085

TRUST_PROXY=1
PORTAL_REGISTRO_ABIERTO=1

# Primer acceso: desactivar MFA; activar cuando el ERP funcione (deploy/SEGURIDAD-FASE3-MFA.md)
MFA_STAFF_REQUIRED=0
MFA_STAFF_WEB_ONLY=1
MFA_TOTP_ISSUER=Educarte ARGO

RATE_LIMIT_LOGIN_MAX=15
RATE_LIMIT_BUSCAR_ALUMNO_MAX=20

SOPORTE_MASTER_ENABLED=false

# SMTP (opcional — verificación correo registro aula)
# PORTAL_EMAIL_VERIFY=1
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_SECURE=0
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM="Educarte Aula <aula@educartecolombia.com>"
EOF

chmod 600 "$ENV_FILE" 2>/dev/null || true

echo "✅ Creado: deploy/.env"
echo ""
echo "URLs tras docker compose up:"
echo "  ERP:           http://${VPS_IP}:8083"
echo "  Aula virtual:  http://${VPS_IP}:8085"
echo "  API (directa): http://${VPS_IP}:5002/api/health"
echo ""
echo "Siguiente paso: ./deploy/deploy-educarte-ip.sh"
