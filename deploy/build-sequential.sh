#!/bin/bash
# Build secuencial (evita quedarse sin RAM en VPS pequeños).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Backend..."
docker compose build argo-backend

echo "==> Frontend ERP..."
docker compose build argo-frontend

echo "==> Sitio marketing..."
docker compose build argo-sitio

echo "==> Portal aula virtual..."
docker compose build argo-aula-virtual

echo "==> Deteniendo stack anterior y quitando contenedores huérfanos..."
docker compose down --remove-orphans 2>/dev/null || true
for c in argo-mongo argo-backend argo-frontend argo-sitio argo-aula-virtual; do
  docker rm -f "$c" 2>/dev/null || true
done

echo "==> Levantando servicios..."
docker compose up -d

echo "==> Estado:"
docker compose ps
curl -sf http://127.0.0.1:5002/api/health && echo || echo "API aún no responde — revisa: docker compose logs argo-backend --tail 40"
