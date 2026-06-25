/**
 * Módulos seleccionables para reset parcial de empresa.
 * Solo incluye colecciones que NO están en CONSERVAR_EN_RESET (catálogos base).
 * El reset completo (sin módulos o con "completo") conserva el comportamiento anterior.
 */

const MODULOS_RESET = [
  {
    id: 'academico',
    etiqueta: 'Académico',
    descripcion: 'Alumnos, matrículas, liquidaciones de matrícula, certificados emitidos y lotes de migración.',
    colecciones: [
      'datosAlumnos',
      'matriculas',
      'liquidacion',
      'certificados',
      'migracionLotes',
    ],
    advertencias: [
      'Si conserva Contable, pueden quedar pagos o recibos sin matrícula asociada.',
    ],
  },
  {
    id: 'contable',
    etiqueta: 'Contable y caja',
    descripcion: 'Ingresos, egresos, sesiones y cierres de caja, clientes de facturación y documentos electrónicos.',
    colecciones: [
      'ingresos',
      'egresos',
      'cajaSesiones',
      'cajaCierresGenerales',
      'cajaDescuadres',
      'clientesFacturacion',
      'facturasElectronicas',
      'notasCreditoElectronicas',
    ],
    advertencias: [
      'Si conserva Académico, las matrículas pueden mostrar saldos desactualizados hasta registrar pagos de nuevo.',
    ],
  },
  {
    id: 'programacion_cea',
    etiqueta: 'Programación CEA y jornadas',
    descripcion:
      'Clases CEA, jornadas de capacitación con empresas, contratos de contratación, supervisores y temarios por programa.',
    colecciones: [
      'clasesProgramadasCea',
      'inscripcionesClaseCea',
      'contratacion',
      'jornadasCap',
      'clasesJornadaCap',
      'asisClasJorCap',
      'supervisores',
      'temasProgramaCea',
    ],
  },
  {
    id: 'cohortes_academicas',
    etiqueta: 'Cohortes académicas (técnicos / diplomados)',
    descripcion:
      'Plan por semestres, materias, grupos (cohortes), inscripciones, clases, asistencias, evaluaciones y materias aprobadas.',
    colecciones: [
      'semestresPrograma',
      'materiasCohorte',
      'catalogoMaterias',
      'esquemasNotasPrograma',
      'cohortes',
      'inscripcionesCohorte',
      'clasesCohorte',
      'asistenciasCohorte',
      'materiasAprobadasCohorte',
      'materialesCohorte',
      'evaluacionesCohorte',
      'intentosEvaluacionCohorte',
      'bancoPreguntasCohorte',
      'notasCriterioCohorte',
    ],
    advertencias: [
      'No borra programas ni alumnos; si conserva Académico pueden quedar referencias huérfanas.',
    ],
  },
  {
    id: 'catalogos_operacion',
    etiqueta: 'Programas, sedes e infraestructura',
    descripcion: 'Programas y servicios con tarifas, combos, sedes, aulas, talleres/patios y plantillas de certificado.',
    colecciones: ['programas', 'servicios', 'combosPrograma', 'sedes', 'aulas', 'talleres', 'plantillasCertificado'],
    advertencias: [
      'Al borrar sedes, el sistema intentará dejar una sede «Principal» solo si ejecuta reset completo o incluye Configuración del sistema.',
    ],
  },
  {
    id: 'rrhh',
    etiqueta: 'RRHH y nómina',
    descripcion: 'Empleados, contratos laborales, documentos del personal y liquidaciones de nómina.',
    colecciones: [
      'empleados',
      'contratos',
      'docsempleados',
      'periodosNomina',
      'novedadesNomina',
      'liquidacionesNomina',
    ],
    advertencias: [
      'Los usuarios del ERP conservan su vínculo con empleados eliminados hasta que resetee Usuarios del personal.',
    ],
  },
  {
    id: 'vehiculos',
    etiqueta: 'Vehículos e inspecciones',
    descripcion: 'Flota, documentos del vehículo, inspecciones técnicas y preoperacionales.',
    colecciones: [
      'vehiculos',
      'docsvehiculos',
      'inspTecPreop',
      'inspeccionesvehiculos',
      'detInspeccion',
    ],
  },
  {
    id: 'aula_virtual',
    etiqueta: 'Aula virtual',
    descripcion: 'Configuración de cursos virtuales, progreso de alumnos, inscripciones a clases y cuentas del portal.',
    colecciones: [
      'capacitacionVirtualConfig',
      'progresoVirtualCurso',
      'inscripcionClase',
      'usuariosPortal',
      'registroPortalPendiente',
    ],
    advertencias: [
      'Las categorías del catálogo virtual (Configuración → Catálogos) se conservan.',
    ],
  },
  {
    id: 'usuarios_personal',
    etiqueta: 'Usuarios del ERP',
    descripcion: 'Elimina a todo el personal excepto quien ejecuta esta operación.',
    especial: 'usuarios',
  },
  {
    id: 'config_sistema',
    etiqueta: 'Configuración y consecutivos',
    descripcion: 'Reinicia configuración de empresa, roles del sistema y consecutivos (recibos, facturas, certificados…) a valores de fábrica.',
    especial: 'config',
  },
  {
    id: 'auditoria',
    etiqueta: 'Auditoría y trazas HTTP',
    descripcion: 'Registro de auditoría y actividad HTTP del servidor.',
    colecciones: ['auditoria', 'actividadHttp'],
  },
];

const MODULOS_POR_ID = Object.fromEntries(MODULOS_RESET.map((m) => [m.id, m]));

const IDS_MODULOS = new Set(MODULOS_RESET.map((m) => m.id));

function listarModulosReset() {
  return MODULOS_RESET.map(({ id, etiqueta, descripcion, advertencias }) => ({
    id,
    etiqueta,
    descripcion,
    advertencias: advertencias || [],
  }));
}

/**
 * @param {string[]|undefined|null} modulos - ids de módulo; vacío o con "completo" = reset total.
 */
function planReset(modulos) {
  const entrada = Array.isArray(modulos) ? modulos.map(String) : [];
  const completo =
    entrada.length === 0 || entrada.includes('completo') || entrada.includes('*');

  if (completo) {
    return {
      completo: true,
      modulos: ['completo'],
      colecciones: null,
      flags: { usuarios: true, config: true, uploads: true, sedePrincipal: true },
    };
  }

  const ids = [...new Set(entrada.filter((id) => IDS_MODULOS.has(id)))];
  if (ids.length === 0) {
    const err = new Error('Seleccione al menos un módulo para el reset parcial');
    err.status = 400;
    throw err;
  }

  const colecciones = new Set();
  for (const id of ids) {
    const mod = MODULOS_POR_ID[id];
    for (const c of mod.colecciones || []) colecciones.add(c);
  }

  return {
    completo: false,
    modulos: ids,
    colecciones,
    flags: {
      usuarios: ids.includes('usuarios_personal'),
      config: ids.includes('config_sistema'),
      uploads: false,
      sedePrincipal: ids.includes('config_sistema') || ids.includes('catalogos_operacion'),
    },
  };
}

function debeLimpiarColeccion(nombre, plan) {
  if (plan.completo) return true;
  return plan.colecciones.has(nombre);
}

module.exports = {
  MODULOS_RESET,
  listarModulosReset,
  planReset,
  debeLimpiarColeccion,
};
