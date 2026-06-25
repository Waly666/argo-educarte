/** Catálogo de permisos disponibles en la aplicación (clave → etiqueta). */
const GRUPOS = [
  {
    id: 'general',
    label: 'General',
    permisos: [{ key: 'dashboard', label: 'Panel principal (dashboard)' }],
  },
  {
    id: 'alumnos',
    label: 'Alumnos',
    permisos: [
      { key: 'alumnos.ver', label: 'Consultar alumnos' },
      { key: 'alumnos.gestionar', label: 'Crear, editar y eliminar alumnos' },
      { key: 'alumnos.pagos', label: 'Pagos, liquidaciones e ingresos' },
      { key: 'alumnos.certificados', label: 'Emitir y consultar certificados' },
      { key: 'certificados.vencidos', label: 'Listado de certificados vencidos' },
    ],
  },
  {
    id: 'academico',
    label: 'Académico',
    permisos: [
      { key: 'programas.ver', label: 'Consultar programas' },
      { key: 'programas.agregar', label: 'Crear programas (sin editar ni eliminar)' },
      { key: 'programas.gestionar', label: 'Administrar programas (editar y eliminar)' },
      { key: 'servicios.ver', label: 'Consultar servicios' },
      { key: 'servicios.gestionar', label: 'Administrar servicios' },
      { key: 'informes.ver', label: 'Informes académicos (listados parametrizables)' },
      { key: 'instructores', label: 'Módulo instructores (legacy)' },
      { key: 'instructores.mi_portal', label: 'Portal del instructor (mi perfil y mis clases)' },
      { key: 'instructores.inspeccion', label: 'Inspección preoperacional de vehículos (instructor)' },
    ],
  },
  {
    id: 'jornadas',
    label: 'Jornadas Cap.',
    permisos: [
      { key: 'jornadas.ver', label: 'Consultar hub, contratos y calendario' },
      { key: 'jornadas.gestionar', label: 'Contratación, programación y edición de jornadas' },
      { key: 'jornadas.operar', label: 'Clase en carpa, clases y asistencia (instructor)' },
    ],
  },
  {
    id: 'programacion_cea',
    label: 'Programación CEA',
    permisos: [
      { key: 'programacion_cea.ver', label: 'Consultar programación, rastreo y calendario CEA' },
      { key: 'programacion_cea.gestionar', label: 'Configurar, temas y programar clases CEA' },
      { key: 'programacion_cea.operar', label: 'Operar clases CEA (inscribir, iniciar/finalizar)' },
    ],
  },
  {
    id: 'cohortes_academicas',
    label: 'Cohortes académicas',
    permisos: [
      { key: 'cohortes_academicas.ver', label: 'Consultar cohortes, plan y clases' },
      { key: 'cohortes_academicas.gestionar', label: 'Plan, cohortes, inscripción y programación de clases' },
      { key: 'cohortes_academicas.operar', label: 'Registrar asistencia y notas (instructor)' },
    ],
  },
  {
    id: 'caja',
    label: 'Caja',
    permisos: [
      { key: 'caja.turno', label: 'Caja del turno (apertura, cuadre, movimientos del día)' },
      { key: 'caja.cobros', label: 'Cobros pendientes' },
      { key: 'caja.admin', label: 'Cierres, descuadres y movimientos globales' },
      { key: 'combos.gestionar', label: 'Combos de cursos presenciales (configurar y aplicar)' },
    ],
  },
  {
    id: 'otros',
    label: 'Otros módulos',
    permisos: [
      { key: 'facturacion', label: 'Facturación' },
      { key: 'vehiculos', label: 'Vehículos' },
      { key: 'rrhh', label: 'Recursos humanos y nómina' },
    ],
  },
  {
    id: 'aula_virtual',
    label: 'Aula virtual',
    permisos: [
      { key: 'aula_virtual.gestionar', label: 'Cursos virtuales, matrículas y usuarios del portal' },
      { key: 'aula_virtual.sitio', label: 'Editor del sitio portal (landing, menús, páginas)' },
      { key: 'aula_virtual.foro', label: 'Foro de cursos (moderar preguntas y respuestas)' },
    ],
  },
  {
    id: 'sedes',
    label: 'Sedes',
    permisos: [
      { key: 'sedes.ver', label: 'Consultar sedes' },
      { key: 'sedes.ver_todas', label: 'Ver y operar en todas las sedes' },
      { key: 'sedes.gestionar', label: 'Administrar catálogo de sedes' },
      { key: 'config.sedes', label: 'Configuración de sedes (alias gestionar)' },
    ],
  },
  {
    id: 'migracion',
    label: 'Migración de datos',
    permisos: [
      { key: 'sistema.migracion', label: 'Importación Excel (alumnos, certificados, lotes)' },
      {
        key: 'migracion.movimientos',
        label: 'Movimientos históricos (matrícula con fecha anterior y recibos de migración)',
      },
    ],
  },
  {
    id: 'config',
    label: 'Configuración',
    permisos: [
      { key: 'config.usuarios', label: 'Gestión de usuarios' },
      { key: 'config.roles', label: 'Roles y permisos' },
      { key: 'config.catalogos', label: 'Catálogos del sistema' },
      { key: 'config.recibos', label: 'Empresa y comprobantes' },
      { key: 'config.georef', label: 'Geocodificación (mapas)' },
      { key: 'config.facturacion', label: 'Facturación electrónica (Factus)' },
      { key: 'config.nomina', label: 'Parámetros de nómina' },
      { key: 'config.certificados', label: 'Diseño de certificados' },
      { key: 'config.alertas', label: 'Alertas y notificaciones' },
      { key: 'config.requisitos', label: 'Requisitos de documentos (alumnos y vehículos)' },
      { key: 'config.auditoria', label: 'Auditoría y monitoreo' },
      { key: 'config.monitor', label: 'Monitor de recursos (incluido en auditoría)' },
    ],
  },
];

function todasLasClaves() {
  const keys = new Set();
  for (const g of GRUPOS) {
    for (const p of g.permisos) keys.add(p.key);
  }
  return [...keys];
}

function clavesValidas(claves) {
  const valid = todasLasClaves();
  return (claves || []).filter((k) => k === '*' || valid.includes(k));
}

module.exports = { GRUPOS, todasLasClaves, clavesValidas };
