/** Catálogo de alarmas / avisos visibles en la aplicación (clave → etiqueta). */
const GRUPOS = [
  {
    id: 'caja',
    label: 'Caja',
    alarmas: [
      { key: 'alarmas.caja.cerrada', label: 'Caja personal cerrada (banner superior)' },
      { key: 'alarmas.caja.sin_abrir', label: 'Aviso modal al cobrar o egresar sin caja abierta' },
      { key: 'alarmas.caja.descuadres', label: 'Descuadres de caja pendientes' },
      { key: 'alarmas.caja.alerta_pago', label: 'Recordatorio de cobro a alumnos (día programado)' },
    ],
  },
  {
    id: 'jornadas',
    label: 'Jornadas Cap.',
    alarmas: [
      { key: 'alarmas.jornadas.en_proceso', label: 'Jornada(s) EN PROCESO hoy (banner superior)' },
      { key: 'alarmas.jornadas.certificado_nuevo', label: 'Certificado recién emitido (banner superior)' },
      { key: 'alarmas.jornadas.live_toast', label: 'Toast al crear clases o jornadas' },
    ],
  },
  {
    id: 'instructores',
    label: 'Portal instructor',
    alarmas: [
      {
        key: 'alarmas.instructores.clase_asignada',
        label: 'Nueva clase asignada al instructor (portal / banner)',
      },
      {
        key: 'alarmas.instructores.clase_proxima',
        label: 'Clase del instructor en los próximos 20 min (portal / banner)',
      },
      {
        key: 'alarmas.instructores.inspeccion_requerida',
        label: 'Inspección preoperacional pendiente antes de la primera práctica del día',
      },
    ],
  },
  {
    id: 'programacion_cea',
    label: 'Programación CEA',
    alarmas: [
      {
        key: 'alarmas.programacion_cea.pendiente',
        label: 'Alumnos/servicios CEA con horas sin programar (banner superior)',
      },
      {
        key: 'alarmas.programacion_cea.clase_proxima',
        label: 'Clase CEA programada en los próximos 15 min (banner superior)',
      },
    ],
  },
  {
    id: 'vehiculos',
    label: 'Vehículos',
    alarmas: [
      { key: 'alarmas.vehiculos.docs_vencidos', label: 'Documentos vencidos o por vencer (banner superior)' },
      { key: 'alarmas.vehiculos.docs_faltantes', label: 'Documentos requeridos sin registrar (banner superior)' },
      { key: 'alarmas.vehiculos.inspeccion_pendiente', label: 'Vehículos sin inspección preoperacional del día (banner superior)' },
    ],
  },
  {
    id: 'empleados',
    label: 'Empleados / RRHH',
    alarmas: [
      { key: 'alarmas.empleados.docs_vencidos', label: 'Documentos vencidos o por vencer (banner superior)' },
      { key: 'alarmas.empleados.docs_faltantes', label: 'Documentos requeridos sin registrar (banner superior)' },
    ],
  },
  {
    id: 'aula_virtual',
    label: 'Aula virtual',
    alarmas: [
      {
        key: 'alarmas.aula_virtual.foro_mensaje',
        label: 'Nuevo mensaje de alumno en foro de curso (banner superior)',
      },
    ],
  },
  {
    id: 'certificados',
    label: 'Certificados',
    alarmas: [
      {
        key: 'alarmas.certificados.vencimiento',
        label: 'Certificados por vencer (banner superior)',
      },
      {
        key: 'alarmas.certificados.vencidos',
        label: 'Certificados vencidos (banner superior)',
      },
    ],
  },
  {
    id: 'alumnos',
    label: 'Alumnos',
    alarmas: [
      { key: 'alarmas.alumnos.saldos', label: 'Saldos pendientes en ficha de alumno' },
      { key: 'alarmas.alumnos.documentos', label: 'Documentos pendientes en ficha de alumno' },
      {
        key: 'alarmas.alumnos.clases_cea_creado',
        label: 'Clases CEA por programar (estado CREADO) en lista, ficha y banner superior',
      },
      {
        key: 'alarmas.alumnos.comprobante_ingreso',
        label: 'Comprobante de ingreso hoy (lista, ficha y banner superior)',
      },
      {
        key: 'alarmas.alumnos.comprobante_egreso',
        label: 'Comprobante de egreso hoy (lista, ficha y banner superior)',
      },
      {
        key: 'alarmas.alumnos.factura',
        label: 'Factura electrónica emitida hoy (lista, ficha y banner superior)',
      },
    ],
  },
];

const ALARMAS_POR_ROL_SISTEMA = {
  admin: ['*'],
  cajero: [
    'alarmas.caja.cerrada',
    'alarmas.caja.sin_abrir',
    'alarmas.caja.descuadres',
    'alarmas.caja.alerta_pago',
    'alarmas.jornadas.en_proceso',
    'alarmas.jornadas.certificado_nuevo',
    'alarmas.certificados.vencimiento',
    'alarmas.certificados.vencidos',
    'alarmas.alumnos.saldos',
    'alarmas.alumnos.documentos',
    'alarmas.alumnos.clases_cea_creado',
    'alarmas.alumnos.comprobante_ingreso',
    'alarmas.alumnos.comprobante_egreso',
    'alarmas.alumnos.factura',
    'alarmas.aula_virtual.foro_mensaje',
    'alarmas.vehiculos.docs_vencidos',
    'alarmas.vehiculos.docs_faltantes',
    'alarmas.vehiculos.inspeccion_pendiente',
    'alarmas.empleados.docs_vencidos',
    'alarmas.empleados.docs_faltantes',
  ],
  instructor: [
    'alarmas.jornadas.certificado_nuevo',
    'alarmas.certificados.vencimiento',
    'alarmas.certificados.vencidos',
    'alarmas.programacion_cea.pendiente',
    'alarmas.programacion_cea.clase_proxima',
    'alarmas.instructores.clase_asignada',
    'alarmas.instructores.clase_proxima',
    'alarmas.instructores.inspeccion_requerida',
    'alarmas.alumnos.clases_cea_creado',
    'alarmas.aula_virtual.foro_mensaje',
    'alarmas.vehiculos.docs_vencidos',
    'alarmas.vehiculos.docs_faltantes',
    'alarmas.vehiculos.inspeccion_pendiente',
    'alarmas.empleados.docs_vencidos',
    'alarmas.empleados.docs_faltantes',
  ],
  recepcion: [
    'alarmas.jornadas.en_proceso',
    'alarmas.jornadas.certificado_nuevo',
    'alarmas.alumnos.saldos',
    'alarmas.alumnos.documentos',
    'alarmas.alumnos.clases_cea_creado',
    'alarmas.alumnos.comprobante_ingreso',
    'alarmas.alumnos.comprobante_egreso',
    'alarmas.alumnos.factura',
    'alarmas.caja.alerta_pago',
    'alarmas.certificados.vencimiento',
    'alarmas.certificados.vencidos',
    'alarmas.vehiculos.docs_vencidos',
    'alarmas.vehiculos.docs_faltantes',
    'alarmas.vehiculos.inspeccion_pendiente',
    'alarmas.empleados.docs_vencidos',
    'alarmas.empleados.docs_faltantes',
    'alarmas.programacion_cea.pendiente',
    'alarmas.programacion_cea.clase_proxima',
    'alarmas.aula_virtual.foro_mensaje',
  ],
  usuario: [
    'alarmas.vehiculos.docs_vencidos',
    'alarmas.vehiculos.docs_faltantes',
    'alarmas.vehiculos.inspeccion_pendiente',
    'alarmas.empleados.docs_vencidos',
    'alarmas.empleados.docs_faltantes',
  ],
};

function todasLasClaves() {
  const keys = new Set();
  for (const g of GRUPOS) {
    for (const a of g.alarmas) keys.add(a.key);
  }
  return [...keys];
}

function clavesValidas(claves) {
  const valid = todasLasClaves();
  return (claves || []).filter((k) => k === '*' || valid.includes(k));
}

function alarmasDefaultRol(codigo) {
  return ALARMAS_POR_ROL_SISTEMA[codigo] ? [...ALARMAS_POR_ROL_SISTEMA[codigo]] : [];
}

module.exports = {
  GRUPOS,
  ALARMAS_POR_ROL_SISTEMA,
  todasLasClaves,
  clavesValidas,
  alarmasDefaultRol,
};
