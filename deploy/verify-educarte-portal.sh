#!/usr/bin/env bash
# Comprueba que el portal en :8085 es build Educarte (no Finstruvial viejo).
set -euo pipefail

PORTAL_URL="${1:-http://127.0.0.1:8085}"
EXPECTED_MARKER="${2:-}"

fail() {
  echo "❌ $1"
  exit 1
}

echo "==> Verificando portal en ${PORTAL_URL}"

marker="$(curl -sf "${PORTAL_URL}/portal-build-marker.txt" 2>/dev/null || true)"
marker="$(echo "$marker" | head -1 | tr -d '\r\n')"

if [[ "$marker" == *"<html"* || "$marker" == *"<!doctype"* ]]; then
  fail "portal-build-marker.txt devuelve HTML — contenedor con build viejo (sin marker)"
fi

echo "    portal-build-marker.txt = ${marker:-missing}"

if [[ -n "$EXPECTED_MARKER" && -n "$marker" && "$marker" != "$EXPECTED_MARKER" ]]; then
  fail "Marker esperado ${EXPECTED_MARKER}, obtuvo ${marker}"
fi

if [[ -z "$marker" || "$marker" == "educarte-skin-pending-build" || "$marker" == "missing" ]]; then
  fail "Marker de build no válido — reconstruya: ./deploy/rebuild-educarte-portal.sh"
fi

html="$(curl -sf "${PORTAL_URL}/" || fail "No responde ${PORTAL_URL}/")"

echo "$html" | grep -qi 'FINSTRUVIAL' && \
  fail "index.html aún menciona FINSTRUVIAL — contenedor viejo o build incorrecto"

echo "$html" | grep -qi 'Educarte Colombia' || \
  echo "⚠ Título sin 'Educarte Colombia' (revise index.html del build)"

echo "$html" | grep -qE 'data-portal-skin=.?educarte|setAttribute\(.data-portal-skin' || \
  echo "⚠ Skin no visible en HTML estático (normal si solo se aplica en main.ts al cargar)"

curl -sfI "${PORTAL_URL}/images/fondo-hero-educarte.png" | grep -qi '200\|304' || \
  fail "Falta imagen /images/fondo-hero-educarte.png en el contenedor"

tema=""
if command -v node >/dev/null 2>&1; then
  tema="$(curl -sf "${PORTAL_URL}/api/aula-virtual/config" | node -e "
let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(s);
    const t=j.site&&j.site.tema||{};
    console.log((t.colorPrimario||'')+'|'+(t.fuente||''));
  } catch { console.log(''); }
});")"
elif docker compose -f docker-compose.educarte.yml exec -T argo-backend node -e "console.log('ok')" >/dev/null 2>&1; then
  tema="$(curl -sf "${PORTAL_URL}/api/aula-virtual/config" | docker compose -f docker-compose.educarte.yml exec -T argo-backend node -e "
let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(s);
    const t=j.site&&j.site.tema||{};
    console.log((t.colorPrimario||'')+'|'+(t.fuente||''));
  } catch { console.log(''); }
});")"
fi

if [[ -n "$tema" ]]; then
  echo "    MongoDB site.tema = ${tema}"
  echo "$tema" | grep -qi '#0B4D3C\|#0b4d3c' || \
    echo "⚠ MongoDB sin verde Educarte — reinicie backend: docker compose -f docker-compose.educarte.yml restart argo-backend"
else
  echo "    MongoDB site.tema = (node no en host; omitido)"
fi

echo "✅ Portal Educarte verificado (marker ${marker})"
