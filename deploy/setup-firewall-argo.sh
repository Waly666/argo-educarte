#!/bin/bash
# Firewall UFW: solo HTTP/HTTPS públicos; puertos Docker ARGO solo localhost.
# Ejecutar como root en el VPS. No bloquea SSH (22) si ya está permitido.
set -euo pipefail

echo "==> Estado actual UFW"
ufw status verbose || true

echo ""
echo "==> Reglas ARGO (entrada)"
ufw allow 22/tcp comment 'SSH' 2>/dev/null || true
ufw allow 80/tcp comment 'HTTP nginx'
ufw allow 443/tcp comment 'HTTPS nginx'

# Puertos Docker expuestos en 0.0.0.0 — cerrar al exterior
for port in 5002 8083 8084 8085 3000 5000 3306 8080; do
  ufw deny "$port/tcp" comment "Bloquear $port público" 2>/dev/null || true
done

echo ""
read -r -p "¿Activar UFW ahora? (y/N): " ans
if [[ "${ans,,}" == "y" || "${ans,,}" == "yes" || "${ans,,}" == "s" || "${ans,,}" == "si" ]]; then
  ufw --force enable
  ufw status numbered
  echo ""
  echo "Listo. ARGO solo accesible por :80 y :443."
else
  echo "Reglas añadidas sin activar. Ejecuta: ufw enable"
fi
