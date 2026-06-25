const { matchIdClase } = require('../services/configRequisitosDocumentosVehiculos');

function aplicaPorClaseVehiculo(claseVehiculoItem, idClase) {
  if (claseVehiculoItem == null || claseVehiculoItem === '') return true;
  if (idClase == null || idClase === '') return false;
  return matchIdClase(claseVehiculoItem, idClase);
}

function filtrarFilasPorClase(rows, idClase) {
  return (rows || []).filter((r) => aplicaPorClaseVehiculo(r.claseVehiculo, idClase));
}

function fechaHoyStr(timeZone = 'America/Bogota') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

function horaActualStr(timeZone = 'America/Bogota') {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function normSi(val) {
  if (val === true || val === 1 || val === '1' || val === 'true' || val === 'si' || val === 'Sí' || val === 'SI') {
    return true;
  }
  if (val === false || val === 0 || val === '0' || val === 'false' || val === 'no' || val === 'No' || val === 'NO') {
    return false;
  }
  return null;
}

module.exports = {
  aplicaPorClaseVehiculo,
  filtrarFilasPorClase,
  fechaHoyStr,
  horaActualStr,
  normSi,
};
