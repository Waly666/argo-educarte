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

html="$(curl -sf "${PORTAL_URL}/" || fail "No responde ${PORTAL_URL}/")"

echo "$html" | grep -qi 'FINSTRUVIAL' && \
  fail "index.html aún menciona FINSTRUVIAL — contenedor viejo o build incorrecto"

echo "$html" | grep -q 'data-portal-skin="educarte"' || \
  fail 'Falta data-portal-skin="educarte" en <html> — build Educarte no desplegado'

echo "$html" | grep -q '#063828\|#0b4d3c\|#fdfbf7' || \
  echo "⚠ CSS inline sin colores Educarte (puede ser normal si solo están en styles.css)"

marker="$(curl -sf "${PORTAL_URL}/portal-build-marker.txt" || echo missing)"
echo "    portal-build-marker.txt = ${marker}"

if [[ -n "$EXPECTED_MARKER" && "$marker" != "$EXPECTED_MARKER" ]]; then
  fail "Marker esperado ${EXPECTED_MARKER}, obtuvo ${marker}"
fi

if [[ "$marker" == "missing" || "$marker" == "educarte-skin-pending-build" ]]; then
  fail "Marker de build no actualizado — reconstruya con PORTAL_BUILD_ID=\$(git rev-parse --short HEAD)"
fi

curl -sfI "${PORTAL_URL}/images/fondo-hero-educarte.png" | grep -qi '200\|304' || \
  fail "Falta imagen /images/fondo-hero-educarte.png en el contenedor"

tema="$(curl -sf "${PORTAL_URL}/api/aula-virtual/config" | node -e "
let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(s);
    const t=j.site&&j.site.tema||{};
    console.log((t.colorPrimario||'')+'|'+(t.fuente||''));
  } catch { console.log(''); }
});")"

echo "    MongoDB site.tema = ${tema}"
echo "$tema" | grep -qi '#0B4D3C\|#0b4d3c' || \
  echo "⚠ MongoDB aún no tiene verde Educarte — ejecute aplicarPlantillaEducartePortal.js"

echo "✅ Portal Educarte verificado (${marker})"
