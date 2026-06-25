/**
 * Estado de progreso de operaciones largas (respaldo, restauración, reset).
 *
 * Singleton de proceso: solo se ejecuta una operación crítica a la vez
 * (protegida por `operacionEnCurso` en respaldos.js), así que un único
 * objeto basta. El frontend lo consulta por polling mientras dura la tarea.
 */

let estado = {
  activo: false,
  tipo: null, // 'respaldo' | 'restauracion' | 'reset' | 'migracion'
  fase: '',
  total: 0,
  hecho: 0,
  estado: 'idle', // 'idle' | 'corriendo' | 'ok' | 'error'
  mensaje: '',
  inicio: 0,
  fin: 0,
};

function iniciar(tipo, fase = 'Iniciando…') {
  estado = {
    activo: true,
    tipo,
    fase,
    total: 0,
    hecho: 0,
    estado: 'corriendo',
    mensaje: '',
    inicio: Date.now(),
    fin: 0,
  };
}

function fase(nombre, { total = null, reiniciarHecho = true } = {}) {
  estado.fase = nombre;
  if (total != null) estado.total = Number(total) || 0;
  if (reiniciarHecho) estado.hecho = 0;
}

function definirTotal(n) {
  estado.total = Number(n) || 0;
}

function avanzar(n = 1) {
  estado.hecho += Number(n) || 0;
  if (estado.total && estado.hecho > estado.total) estado.hecho = estado.total;
}

function finalizar(estadoFinal = 'ok', mensaje = '') {
  estado.activo = false;
  estado.estado = estadoFinal;
  estado.mensaje = mensaje || '';
  estado.fin = Date.now();
  if (estadoFinal === 'ok' && estado.total) estado.hecho = estado.total;
}

function obtener() {
  const { activo, tipo, fase: f, total, hecho, estado: e, mensaje, inicio, fin } = estado;
  const porcentaje = total > 0 ? Math.min(100, Math.round((hecho / total) * 100)) : null;
  return {
    activo,
    tipo,
    fase: f,
    total,
    hecho,
    porcentaje,
    estado: e,
    mensaje,
    transcurridoMs: inicio ? (fin || Date.now()) - inicio : 0,
  };
}

module.exports = { iniciar, fase, definirTotal, avanzar, finalizar, obtener };
