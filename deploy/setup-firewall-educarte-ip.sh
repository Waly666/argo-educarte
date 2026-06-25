#!/usr/bin/env bash
# UFW para fase IP: SSH + puertos Docker Educarte. NO usar setup-firewall-argo.sh (bloquea 8083).
# Ejecutar en el VPS como root: sudo ./deploy/setup-firewall-educarte-ip.sh
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Ejecute con sudo"
  exit 1
fi

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 8083/tcp comment 'Educarte ERP'
ufw allow 8085/tcp comment 'Educarte aula virtual'
# Opcional: API directa (móvil / pruebas). Comente si solo usará nginx en 8083/8085.
ufw allow 5002/tcp comment 'Educarte API directa'
ufw --force enable
ufw status verbose

echo ""
echo "Cuando pase a dominio + HTTPS, use deploy/setup-nginx-ssl.sh y cierre 8083/8085/5002 al público."
