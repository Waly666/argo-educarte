#!/usr/bin/env bash
# Diagnóstico + corrección tema Educarte en VPS (portal Docker + MongoDB + nginx).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE=(docker compose -f docker-compose.educarte.yml)

echo "========== DIAGNÓSTICO =========="
echo "Directorio: $ROOT"
echo "Git: $(git log -1 --oneline 2>/dev/null || echo 'sin git')"
echo ""

echo -n "Portal :8085 título: "
curl -sf http://127.0.0.1:8085/ 2>/dev/null | tr '\n' ' ' | grep -oP '(?<=<title>)[^<]+' | head -1 || echo "(no responde)"

echo -n "Marker en contenedor: "
curl -sf http://127.0.0.1:8085/portal-build-marker.txt 2>/dev/null | head -1 || echo "(404 o index.html — build viejo)"

echo -n "MongoDB colorPrimario: "
if command -v node >/dev/null 2>&1; then
  curl -sf http://127.0.0.1:8085/api/aula-virtual/config 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).site.tema.colorPrimario)}catch{console.log('?')}})" || echo "?"
else
  curl -sf http://127.0.0.1:8085/api/aula-virtual/config 2>/dev/null | "${COMPOSE[@]}" exec -T argo-backend node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).site.tema.colorPrimario)}catch{console.log('?')}})" 2>/dev/null || echo "(use docker backend)"
fi

echo ""
echo "Contenedores:"
"${COMPOSE[@]}" ps argo-aula-virtual argo-backend 2>/dev/null || docker ps --filter name=argo-educarte

echo ""
echo "========== CORRECCIÓN =========="
chmod +x deploy/*.sh
./deploy/rebuild-educarte-portal.sh

echo ""
echo "========== BACKEND (tema MongoDB) =========="
"${COMPOSE[@]}" up -d --force-recreate argo-backend
sleep 4
"${COMPOSE[@]}" logs argo-backend --tail 15 | grep -i educarte || true

echo ""
echo "Si tiene nginx + dominio:"
echo "  sudo ./deploy/apply-educarte-nginx-inject.sh"
echo "  Cloudflare → Purge Everything"
