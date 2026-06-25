const os = require('os');

const inicioServidor = Date.now();
let ultimaMuestraCpu = {
  uso: process.cpuUsage(),
  hr: process.hrtime.bigint(),
};

function mb(bytes) {
  return Math.round((bytes / 1048576) * 10) / 10;
}

function cpuProcesoPct() {
  const ahora = process.cpuUsage(ultimaMuestraCpu.uso);
  const transcurridoUs = Number(process.hrtime.bigint() - ultimaMuestraCpu.hr) / 1000;
  ultimaMuestraCpu = { uso: process.cpuUsage(), hr: process.hrtime.bigint() };
  if (transcurridoUs <= 0) return 0;
  const pct = ((ahora.user + ahora.system) / transcurridoUs) * 100;
  return Math.round(Math.min(pct, os.cpus().length * 100) * 10) / 10;
}

function obtenerMetricasSistema() {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const libreMem = os.freemem();
  const load = os.loadavg();

  return {
    uptimeSegundos: Math.floor(process.uptime()),
    uptimeServidorSegundos: Math.floor((Date.now() - inicioServidor) / 1000),
    cpuProcesoPct: cpuProcesoPct(),
    cpuSistemaLoad1: Math.round((load[0] || 0) * 100) / 100,
    nucleos: os.cpus().length,
    memoriaProceso: {
      rssMb: mb(mem.rss),
      heapUsedMb: mb(mem.heapUsed),
      heapTotalMb: mb(mem.heapTotal),
      externalMb: mb(mem.external || 0),
    },
    memoriaSistema: {
      totalMb: mb(totalMem),
      libreMb: mb(libreMem),
      usadaMb: mb(totalMem - libreMem),
      usoPct: Math.round(((totalMem - libreMem) / totalMem) * 1000) / 10,
    },
    plataforma: `${os.type()} ${os.release()}`,
    node: process.version,
  };
}

module.exports = {
  obtenerMetricasSistema,
};
