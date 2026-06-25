#!/bin/bash
# Restaura backup Mongo en el contenedor argo-mongo.
# Uso:
#   bash deploy/restore-mongo.sh backup/backup-argo.zip
#   bash deploy/restore-mongo.sh backup/mongo-dump/argo   (carpeta sin zip, recomendado)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${1:-$ROOT/backup/mongo-dump/argo}"
TMP="/tmp/argo-mongo-restore"

cd "$ROOT"

if [ ! -e "$SOURCE" ]; then
  echo "No se encontró: $SOURCE"
  echo "Sube por WinSCP la carpeta backup-argo/argo → /opt/argo/backup/mongo-dump/argo"
  exit 1
fi

echo "==> Levantando Mongo..."
docker compose up -d argo-mongo
sleep 4

DUMP_DIR=""

if [ -d "$SOURCE" ] && [ -f "$SOURCE/usuarios.bson" ]; then
  DUMP_DIR="$(cd "$SOURCE" && pwd)"
elif [ -d "$SOURCE" ]; then
  DUMP_DIR="$(find "$(cd "$SOURCE" && pwd)" -type f -name 'usuarios.bson' 2>/dev/null | head -1 | xargs dirname)"
elif [ -f "$SOURCE" ] && [[ "$SOURCE" == *.zip ]]; then
  echo "==> Descomprimiendo zip..."
  rm -rf "$TMP"
  mkdir -p "$TMP"
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$SOURCE" "$TMP" <<'PY'
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])
PY
  else
    unzip -qo "$SOURCE" -d "$TMP"
  fi
  USERS_BSON="$(find "$TMP" -type f -name 'usuarios.bson' 2>/dev/null | head -1 || true)"
  if [ -z "$USERS_BSON" ]; then
    echo "ERROR: el zip no contiene usuarios.bson"
    find "$TMP" -type f | head -20
    exit 1
  fi
  DUMP_DIR="$(dirname "$USERS_BSON")"
else
  echo "ERROR: origen no válido: $SOURCE"
  exit 1
fi

if [ -z "$DUMP_DIR" ] || [ ! -d "$DUMP_DIR" ]; then
  echo "ERROR: no se encontró carpeta del dump"
  exit 1
fi

if [ ! -f "$DUMP_DIR/usuarios.bson" ]; then
  echo "ERROR: falta usuarios.bson en $DUMP_DIR"
  ls -la "$DUMP_DIR" | head -15
  exit 1
fi

BSON_COUNT="$(find "$DUMP_DIR" -maxdepth 1 -name '*.bson' 2>/dev/null | wc -l | tr -d ' ')"
echo "==> Dump OK: $DUMP_DIR ($BSON_COUNT colecciones)"

echo "==> mongorestore (montando carpeta, sin docker cp)..."
docker run --rm \
  --network container:argo-mongo \
  -v "$DUMP_DIR:/dump:ro" \
  mongo:6 mongorestore --drop --db argo /dump

USERS="$(docker exec argo-mongo mongosh argo --quiet --eval 'db.usuarios.countDocuments()')"
ALUMNOS="$(docker exec argo-mongo mongosh argo --quiet --eval 'db.datosAlumnos.countDocuments()')"
COLS="$(docker exec argo-mongo mongosh argo --quiet --eval 'db.getCollectionNames().length')"

echo "==> Restauración OK"
echo "    Colecciones: $COLS"
echo "    Usuarios:    $USERS"
echo "    Alumnos:     $ALUMNOS"

if [ "${USERS:-0}" -eq 0 ]; then
  echo "ERROR: usuarios=0 — revisa el backup."
  exit 1
fi

rm -rf "$TMP"
echo "==> Reinicia backend: docker compose restart argo-backend"
