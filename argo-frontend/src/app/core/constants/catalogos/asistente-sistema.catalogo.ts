import type { AsistenteContexto } from '../asistente.types';

/** Ayuda Mia — Aula virtual, informes académicos, backup/restore/reset/migración. */
export const ASISTENTE_SISTEMA: Record<string, AsistenteContexto> = {
  'aula-virtual.admin': {
    id: 'aula-virtual.admin',
    modulo: 'aula_virtual',
    saludo: 'Administración del portal Aula Virtual para alumnos.',
    tips: [
      {
        id: 'av-a-1',
        titulo: 'Qué configura aquí',
        cuerpo:
          'Logo, textos de bienvenida, cursos visibles en el catálogo público y opciones del portal donde los alumnos consultan certificados y acceden a su aula.',
      },
      {
        id: 'av-a-2',
        titulo: 'Cohortes en el portal',
        cuerpo:
          'Los alumnos inscritos en cohortes ven en «Mis clases» el calendario, materiales, evaluaciones y enlaces Meet de su grupo.',
      },
      {
        id: 'av-a-3',
        titulo: 'Editor del sitio',
        cuerpo:
          'Use «Editor sitio portal» (menú relacionado) para personalizar la página pública: hero, secciones, imágenes y enlaces de la landing.',
      },
      {
        id: 'av-a-4',
        titulo: 'Certificados consultables',
        cuerpo:
          'Los certificados emitidos pueden consultarse por código de verificación desde el portal, según la configuración de certificados.',
      },
    ],
  },
  'aula-virtual.sitio': {
    id: 'aula-virtual.sitio',
    modulo: 'aula_virtual',
    saludo: 'Editor visual del sitio público del Aula Virtual.',
    tips: [
      {
        id: 'av-s-1',
        titulo: 'Vista previa en vivo',
        cuerpo:
          'Edite bloques de la landing (hero, cursos, contacto, fundación…) y guarde. Los cambios se reflejan en el portal que ven los visitantes.',
      },
      {
        id: 'av-s-2',
        titulo: 'Imágenes y textos',
        cuerpo:
          'Suba imágenes optimizadas y textos claros para personas que llegan por primera vez. No hace falta saber programar.',
      },
      {
        id: 'av-s-3',
        titulo: 'Coherencia con ARGO',
        cuerpo:
          'El catálogo de cursos suele alimentarse desde programas/servicios configurados en el ERP. Revise que los cursos publicados existan y estén activos.',
      },
    ],
  },
  'informes.hub': {
    id: 'informes.hub',
    modulo: 'informes',
    saludo: 'Informes académicos y operativos del CEA.',
    tips: [
      {
        id: 'inf-h-1',
        titulo: 'Catálogo de informes',
        cuerpo:
          'Lista de reportes disponibles según su rol: matrículas, cartera, asistencia, certificados, etc. Elija uno para ver filtros y generar.',
      },
      {
        id: 'inf-h-2',
        titulo: 'Filtros',
        cuerpo:
          'Ajuste fechas, programa, sede o estado antes de ejecutar. Menos filtros = reporte más amplio.',
      },
      {
        id: 'inf-h-3',
        titulo: 'Exportar',
        cuerpo:
          'Muchos informes permiten exportar a Excel o PDF según el tipo. Use para auditorías o reuniones.',
      },
    ],
  },
  'informes.detalle': {
    id: 'informes.detalle',
    modulo: 'informes',
    saludo: 'Ejecución de un informe con filtros y resultados.',
    tips: [
      {
        id: 'inf-d-1',
        titulo: 'Parámetros',
        cuerpo:
          'Complete los campos obligatorios (fechas, sede, etc.) y pulse generar. Si falta un dato, el sistema lo indicará.',
      },
      {
        id: 'inf-d-2',
        titulo: 'Interpretar resultados',
        cuerpo:
          'Las tabas y totales resumen el periodo elegido. Compare con el mismo informe en otro rango de fechas si necesita tendencias.',
      },
    ],
  },
  'sistema.backup': {
    id: 'sistema.backup',
    modulo: 'sistema',
    saludo: 'Respaldo (backup) de la base de datos ARGO.',
    tips: [
      {
        id: 'sys-bk-1',
        titulo: 'Solo administradores',
        cuerpo:
          'Pantalla restringida. Genere respaldos antes de migraciones, resets o cambios masivos en producción.',
      },
      {
        id: 'sys-bk-2',
        titulo: 'Descargar archivo',
        cuerpo:
          'El backup se descarga como archivo. Guárdelo en lugar seguro fuera del servidor (nube, disco externo).',
      },
      {
        id: 'sys-bk-3',
        titulo: 'Frecuencia recomendada',
        cuerpo:
          'Backup diario o semanal según volumen de operación. Pruebe restaurar en ambiente de prueba al menos una vez.',
      },
    ],
  },
  'sistema.restore': {
    id: 'sistema.restore',
    modulo: 'sistema',
    saludo: 'Restaurar un respaldo previo.',
    tips: [
      {
        id: 'sys-rs-1',
        titulo: 'Operación delicada',
        cuerpo:
          'Sobrescribe datos actuales con el contenido del archivo de backup. Detenga operación de caja y usuarios antes de restaurar.',
      },
      {
        id: 'sys-rs-2',
        titulo: 'Archivo correcto',
        cuerpo:
          'Use un backup generado por la misma versión de ARGO cuando sea posible. Verifique fecha y sede si aplica.',
      },
      {
        id: 'sys-rs-3',
        titulo: 'Después de restaurar',
        cuerpo:
          'Revise consecutivos, sesiones de caja abiertas y usuarios. Puede requerir reiniciar servicios.',
      },
    ],
  },
  'sistema.reset': {
    id: 'sistema.reset',
    modulo: 'sistema',
    saludo: 'Puesta en cero (reset) de módulos o empresa.',
    tips: [
      {
        id: 'sys-rst-1',
        titulo: 'Irreversible',
        cuerpo:
          'Elimina datos operativos según las opciones marcadas. Haga backup antes. No use en producción sin autorización explícita.',
      },
      {
        id: 'sys-rst-2',
        titulo: 'Alcance por módulo',
        cuerpo:
          'Puede resetear solo ciertos módulos (alumnos, caja, certificados…) o datos de prueba. Lea cada casilla con cuidado.',
      },
      {
        id: 'sys-rst-3',
        titulo: 'Entorno de prueba',
        cuerpo:
          'Ideal para limpiar datos de capacitación o demos. En producción preferir backup + restore selectivo.',
      },
    ],
  },
  'sistema.migracion': {
    id: 'sistema.migracion',
    modulo: 'sistema',
    saludo: 'Migración de datos históricos (certificados, alumnos, etc.).',
    tips: [
      {
        id: 'sys-mig-1',
        titulo: 'Flujo recomendado',
        cuerpo:
          '1) Descargue plantilla → 2) Complete datos → 3) Valide archivo → 4) Importe con barra de progreso. Corrija errores antes de importar.',
      },
      {
        id: 'sys-mig-2',
        titulo: 'Validación previa',
        cuerpo:
          'La validación no escribe en base de datos; solo reporta filas con problemas (fechas, duplicados, campos vacíos).',
      },
      {
        id: 'sys-mig-3',
        titulo: 'Certificados históricos',
        cuerpo:
          'Incluya codVerificacion si debe consultarse en el portal. Revise opciones de integridad si ya existen certificados en el sistema.',
      },
      {
        id: 'sys-mig-4',
        titulo: 'No sobrescribir sin querer',
        cuerpo:
          'Lea las opciones de importación: algunas migraciones pueden omitir duplicados o actualizar registros existentes.',
      },
    ],
  },
};
