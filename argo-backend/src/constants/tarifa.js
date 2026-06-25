/** Tarifas 1–3: presencial / app web. Tarifa 4: educación virtual (portal aula virtual). */
const TARIFA_VIRTUAL = 4;
/** Refrendación / renovación de certificados no formales (mismo que tarifa presencial 3). */
const TARIFA_REVALIDACION = 3;

const TARIFAS_PRESENCIAL = [1, 2, 3];

function esTarifaVirtual(tarifa) {
  return Number(tarifa) === TARIFA_VIRTUAL;
}

module.exports = {
  TARIFA_VIRTUAL,
  TARIFA_REVALIDACION,
  TARIFAS_PRESENCIAL,
  esTarifaVirtual,
};
