const {
  crearRespaldo,
  aplicarRetencion,
  obtenerConfigRespaldos,
} = require('./respaldos');
const { registrarAuditoria } = require('./auditoria');

let timer = null;
let ultimaEjecucion = ''; // 'YYYY-MM-DD HH:mm' para no repetir en el mismo minuto

function claveMinuto(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function horaActual(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function tick() {
  try {
    const cfg = await obtenerConfigRespaldos();
    if (!cfg.autoHabilitado) return;
    const ahora = new Date();
    if (horaActual(ahora) !== cfg.horaAuto) return;
    const clave = claveMinuto(ahora);
    if (ultimaEjecucion === clave) return;
    ultimaEjecucion = clave;

    const meta = await crearRespaldo({ tipo: 'auto', usuario: 'sistema' });
    const eliminados = await aplicarRetencion(cfg.retencionDias);
    console.log(
      `[ARGO respaldos] Automático creado: ${meta.archivo} (${meta.totalDocs} docs)` +
        (eliminados ? ` — rotación: ${eliminados} antiguo(s) eliminado(s)` : ''),
    );
    registrarAuditoria({
      accion: 'respaldo_auto',
      entidad: 'respaldo',
      idEntidad: meta.archivo,
      resumen: `Respaldo automático ${meta.archivo} (${meta.totalDocs} documentos, ${meta.colecciones} colecciones)`,
      datosDespues: meta,
    }).catch(() => {});
  } catch (err) {
    console.error('[ARGO respaldos] Error en respaldo automático:', err.message);
    registrarAuditoria({
      accion: 'respaldo_auto_error',
      entidad: 'respaldo',
      resumen: `Falló el respaldo automático: ${err.message}`,
    }).catch(() => {});
  }
}

function initRespaldosAuto() {
  if (timer) return;
  timer = setInterval(tick, 30 * 1000);
  timer.unref();
  console.log('[ARGO respaldos] Programador de respaldos automáticos activo');
}

module.exports = { initRespaldosAuto };
