const { CATALOGOS } = require('../models/catalogos');

/**
 * Clasificación de colecciones para el reset de empresa (puesta en cero).
 *
 * CONSERVAR: los CATÁLOGOS base (las tablas de Configuración → Catálogos), que
 * sirven igual para cualquier empresa y NO deben tocarse en el reset.
 * Todo lo que NO esté aquí se limpia: programas, servicios, temarios, clases,
 * liquidaciones, alumnos, pagos, etc. (datos propios de la empresa). Cualquier
 * colección nueva que se agregue en el futuro se trata por defecto como dato
 * de empresa (se limpia).
 */

/**
 * Tablas del modelo CATALOGOS que igual se limpian en el reset:
 * - programas, servicios: datos de la empresa (pantalla propia, no catálogo base).
 * - aulas, talleres: están en Configuración → Catálogos pero dependen de sedes
 *   (las sedes sí se borran); vuelven al restaurar la copia de seguridad previa.
 */
const NO_SON_CATALOGO_BASE = new Set(['programas', 'servicios', 'aulas', 'talleres']);

const CONSERVAR_EN_RESET = new Set([
  // Catálogos base (Configuración → Catálogos), salvo las excepciones de arriba.
  ...Object.values(CATALOGOS).filter((c) => !NO_SON_CATALOGO_BASE.has(c)),
  // Administradoras (catálogos del Ministerio)
  'eps',
  'afp',
  'arl',
  'cajasCompensacion',
  // Catálogos RRHH genéricos
  'cargos',
  'departamentosEmpresa',
  // Nota: temasProgramaCea (temario) NO se conserva: depende de los programas,
  // que se limpian en el reset, así que se elimina como dato de empresa.
]);

/**
 * Colecciones con manejo especial (no se eliminan completas):
 * - usuarios: se conserva únicamente el administrador que ejecuta el reset.
 * - config: se vacía; los servicios recrean los valores por defecto
 *   (consecutivos de recibos, certificados e inspecciones quedan en 0).
 * - roles_app: se vacía y se reinicializan los roles del sistema.
 */
const COLECCIONES_ESPECIALES = new Set(['usuarios', 'config', 'roles_app']);

module.exports = { CONSERVAR_EN_RESET, COLECCIONES_ESPECIALES };
