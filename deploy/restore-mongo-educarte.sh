#!/usr/bin/env bash
# Restaura backup Mongo en stack Educarte (docker-compose.educarte.yml).
# Uso: ./deploy/restore-mongo-educarte.sh backup/mongo-dump/argo-educarte
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${1:-$ROOT/backup/mongo-dump/argo-educarte}"
COMPOSE=(docker compose -f docker-compose.educarte.yml)
MONGO_CONTAINER=argo-educarte-mongo
DB=argo-educarte
TMP="/tmp/argo-educarte-mongo-restore"

cd "$ROOT"

if [[ ! -e "$SOURCE" ]]; then
  echo "No se encontró: $SOURCE"
  exit 1
fi

echo "==> Levantando Mongo..."
"${COMPOSE[@]}" up -d argo-mongo
sleep 4

DUMP_DIR=""
if [[ -d "$SOURCE" && -f "$SOURCE/usuarios.bson" ]]; then
  DUMP_DIR="$(cd "$SOURCE" && pwd)"
elif [[ -d "$SOURCE" ]]; then
  DUMP_DIR="$(find "$(cd "$SOURCE" && pwd)" -type f -name 'usuarios.bson' 2>/dev/null | head -1 | xargs dirname)"
elif [[ -f "$SOURCE" && "$SOURCE" == *.zip ]]; then
  rm -rf "$TMP"
  mkdir -p "$TMP"
  unzip -qo "$SOURCE" -d "$TMP"
  USERS_BSON="$(find "$TMP" -type f -name 'usuarios.bson' 2>/dev/null | head -1 || true)"
  [[ -n "$USERS_BSON" ]] || { echo "ERROR: zip sin usuarios.bson"; exit 1; }
  DUMP_DIR="$(dirname "$USERS_BSON")"
else
  echo "ERROR: origen no válido"
  exit 1
fi

echo "==> mongorestore → $DB ..."
docker run --rm \
  --network "container:${MONGO_CONTAINER}" \
  -v "$DUMP_DIR:/dump:ro" \
  mongo:6 mongorestore --drop --db "$DB" /dump

USERS="$(docker exec "$MONGO_CONTAINER" mongosh "$DB" --quiet --eval 'db.usuarios.countDocuments()')"
echo "==> Usuarios restaurados: $USERS"
rm -rf "$TMP"
"${COMPOSE[@]}" restart argo-backend
