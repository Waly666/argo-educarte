import type { AsistenteContexto } from '../asistente.types';

export const ASISTENTE_OPERACION: Record<string, AsistenteContexto> = {
  'certificados.lista': {
    id: 'certificados.lista',
    modulo: 'certificados',
    saludo: 'Vista global de certificados emitidos en el CEA.',
    tips: [
      {
        id: 'cert-l-1',
        titulo: 'Alcance transversal',
        cuerpo:
          'Certificados de todos los alumnos. Complementa la pestaña Certificados dentro de cada ficha individual.',
      },
      {
        id: 'cert-l-2',
        titulo: 'Filtros',
        cuerpo:
          'Por tipo, fecha, estado o vencimiento. Use para campañas de renovación o auditoría ante autoridad.',
      },
      {
        id: 'cert-l-3',
        titulo: 'Vencidos y por vencer',
        cuerpo:
          'Alimentan alertas del encabezado. Certificado vencido sigue en historial; reemitir depende de norma del CEA.',
      },
      {
        id: 'cert-l-4',
        titulo: 'Consecutivo',
        cuerpo:
          'Número único por tipo configurado. No reutilice consecutivos manualmente.',
      },
      {
        id: 'cert-l-5',
        titulo: 'Ir al alumno',
        cuerpo:
          'Desde detalle puede abrir ficha del alumno para revisar pagos o documentos si hay bloqueo.',
      },
    ],
  },
  'jornadas.hub': {
    id: 'jornadas.hub',
    modulo: 'jornadas',
    saludo: 'Centro de jornadas de capacitación (cursos grupales).',
    tips: [
      {
        id: 'jor-h-ctx',
        titulo: 'Contexto de esta pantalla',
        cuerpo:
          'Gestione contratos con empresas, programe carpas por fecha, opere clases del día y emita certificados automáticos.',
      },
      {
        id: 'jor-h-1',
        titulo: 'Jornada vs clase CEA',
        cuerpo:
          'Jornada = curso grupal de capacitación (transito, seguridad vial…). Clase CEA = módulo licencia conducción en Programación CEA. Son módulos distintos.',
      },
      {
        id: 'jor-h-2',
        titulo: 'Crear jornada',
        cuerpo:
          'Defina fechas, cupos, instructor, sede y módulos. Estados: programada → en proceso → cumplida/cancelada.',
      },
      {
        id: 'jor-h-3',
        titulo: 'Inscribir alumnos',
        cuerpo:
          'Desde la jornada o lista de alumnos modo jornadas. Verifique cupos disponibles.',
      },
      {
        id: 'jor-h-4',
        titulo: 'Alertas',
        cuerpo:
          'Jornada en proceso, contrato por vencer o certificado pendiente generan franjas parpadeantes arriba.',
      },
      {
        id: 'jor-h-5',
        titulo: 'Accesos rápidos',
        cuerpo:
          'Enlaces a clases hoy, en proceso, certificados de jornada e instructor según permisos.',
      },
    ],
  },
  'jornadas.instructor': {
    id: 'jornadas.instructor',
    modulo: 'jornadas',
    saludo: 'Operación de jornada — vista del instructor.',
    tips: [
      {
        id: 'jor-i-1',
        titulo: 'Mis jornadas/clases',
        cuerpo:
          'Solo ve grupos asignados a usted. Coordinador ve más con permisos amplios.',
      },
      {
        id: 'jor-i-2',
        titulo: 'Lista de asistencia',
        cuerpo:
          'Marque presente/ausente por sesión. Impacta certificados de jornada y cumplimiento legal.',
      },
      {
        id: 'jor-i-3',
        titulo: 'Guardar asistencia',
        cuerpo:
          'Confirme antes de salir. Cambios tardíos pueden requerir ajuste administrativo.',
      },
      {
        id: 'jor-i-4',
        titulo: 'Observaciones',
        cuerpo:
          'Registre novedades por alumno (retraso, retiro) en campos de observación si existen.',
      },
    ],
  },
  'jornadas.en-proceso': {
    id: 'jornadas.en-proceso',
    modulo: 'jornadas',
    saludo: 'Jornadas activas en este momento o ventana operativa.',
    tips: [
      {
        id: 'jor-ep-1',
        titulo: 'Seguimiento diario',
        cuerpo:
          'Lista jornadas que deben tener asistencia hoy. Priorice registrar asistencia antes de fin de jornada.',
      },
      {
        id: 'jor-ep-2',
        titulo: 'Estado en vivo',
        cuerpo:
          'Filas pueden parpadear cuando la sesión está en horario según reloj del sistema.',
      },
    ],
  },
  'jornadas.clases-hoy': {
    id: 'jornadas.clases-hoy',
    modulo: 'jornadas',
    saludo: 'Agenda de clases de jornada para hoy.',
    tips: [
      {
        id: 'jor-ch-1',
        titulo: 'Vista del día',
        cuerpo:
          'Horario, aula/sede, instructor y grupo. Use para control de sala.',
      },
      {
        id: 'jor-ch-2',
        titulo: 'Impuntualidades',
        cuerpo:
          'Registre asistencia real; no asuma presente por estar inscrito.',
      },
    ],
  },
  'jornadas.certificados': {
    id: 'jornadas.certificados',
    modulo: 'jornadas',
    saludo: 'Certificados ligados a jornadas de capacitación.',
    tips: [
      {
        id: 'jor-ce-1',
        titulo: 'Emisión',
        cuerpo:
          'Requiere jornada cumplida y asistencia mínima según reglas. Pagos al día si aplica.',
      },
      {
        id: 'jor-ce-2',
        titulo: 'Individual o lote',
        cuerpo:
          'Emita por alumno o revise pendientes masivos según botones de la pantalla.',
      },
    ],
  },
  'jornadas.contratos': {
    id: 'jornadas.contratos',
    modulo: 'jornadas',
    saludo: 'Contratos empresariales para jornadas.',
    tips: [
      {
        id: 'jor-co-ctx',
        titulo: 'Contexto de esta pantalla',
        cuerpo:
          'Listado completo de contrataciones. Use Editar para abrir el contrato en el módulo Jornadas y trabajar sus jornadas/clases, o Eliminar si aún no tiene jornadas con clases registradas.',
      },
      {
        id: 'jor-co-1',
        titulo: 'Convenio',
        cuerpo:
          'Empresa compra cupos. Vincule jornadas y tarifas especiales.',
      },
      {
        id: 'jor-co-2',
        titulo: 'Vigencia',
        cuerpo:
          'Contrato vencido puede bloquear nuevas inscripciones bajo ese convenio.',
      },
      {
        id: 'jor-co-3',
        titulo: 'Facturación',
        cuerpo:
          'Puede facturarse al cliente empresa (catálogo Clientes) separado del alumno participante.',
      },
    ],
  },
  'programacion-cea.hub': {
    id: 'programacion-cea.hub',
    modulo: 'programacion_cea',
    saludo: 'Hub de programación de clases para licencia de conducción.',
    tips: [
      {
        id: 'cea-h-1',
        titulo: 'Teoría, taller y práctica',
        cuerpo:
          'Accesos a calendarios grupales y prácticas en vehículo. Cada tipo tiene reglas de cupo e instructor.',
      },
      {
        id: 'cea-h-2',
        titulo: 'Clases hoy CEA',
        cuerpo:
          'Vista operativa del día. Coordine con alertas del encabezado (clase próxima, pendientes).',
      },
      {
        id: 'cea-h-3',
        titulo: 'Sede',
        cuerpo:
          'Programación puede filtrar por sede. Cupos no se comparten entre sedes salvo configuración especial.',
      },
      {
        id: 'cea-h-4',
        titulo: 'Automatización',
        cuerpo:
          'ARGO puede sugerir o crear clases según reglas (ver alertas «clase creada» / «pendiente programar»).',
      },
    ],
  },
  'programacion-cea.clases-grupales': {
    id: 'programacion-cea.clases-grupales',
    modulo: 'programacion_cea',
    saludo: 'Calendario — teoría y taller (clases grupales CEA).',
    tips: [
      {
        id: 'cea-g-ctx',
        titulo: 'Contexto de esta pantalla',
        cuerpo:
          'Programe cupos de teoría y taller al mes, inscriba alumnos en estado PROGRAMADA y consulte el descuento de horas.',
      },
      {
        id: 'cea-g-1',
        titulo: 'Crear clase (+ en día)',
        cuerpo:
          'Horario inicio/fin, aula, instructor, cupos máximos, categoría licencia (A2, B1…).',
      },
      {
        id: 'cea-g-2',
        titulo: 'Cupos',
        cuerpo:
          'Inscripción desde ficha alumno → Programación. Cupo lleno bloquea nuevas inscripciones.',
      },
      {
        id: 'cea-g-3',
        titulo: 'Editar / cancelar',
        cuerpo:
          'Cambios de horario afectan alumnos inscritos; comuníquelos. Cancelar libera cupos.',
      },
      {
        id: 'cea-g-4',
        titulo: 'Asistencia',
        cuerpo:
          'Registro post-clase. Horas suman al cumplimiento del plan de formación.',
      },
      {
        id: 'cea-g-5',
        titulo: 'Vista calendario',
        cuerpo:
          'Colores por tipo/estado. Clase en curso puede resaltarse en vivo.',
      },
    ],
  },
  'programacion-cea.clases-practica': {
    id: 'programacion-cea.clases-practica',
    modulo: 'programacion_cea',
    saludo: 'Calendario — práctica en vehículo.',
    tips: [
      {
        id: 'cea-p-ctx',
        titulo: 'Contexto de esta pantalla',
        cuerpo:
          'Programe clases individuales en vehículo. Busque al alumno como en jornadas, créelas o edítelas desde la lista.',
      },
      {
        id: 'cea-p-1',
        titulo: 'Recursos obligatorios',
        cuerpo:
          'Vehículo disponible, SOAT/tecno al día, instructor habilitado, alumno con servicio práctica matriculado.',
      },
      {
        id: 'cea-p-2',
        titulo: 'Conflictos',
        cuerpo:
          'ARGO evita doble booking de vehículo o instructor en mismo horario.',
      },
      {
        id: 'cea-p-3',
        titulo: 'Buscar alumno',
        cuerpo:
          'Mismo buscador que jornadas. Verifique categoría de licencia coherente con vehículo.',
      },
      {
        id: 'cea-p-4',
        titulo: 'Inspección preoperacional',
        cuerpo:
          'Vehículo puede requerir inspección del día antes de salir a vía (módulo Vehículos).',
      },
    ],
  },
  'programacion-cea.clases-hoy': {
    id: 'programacion-cea.clases-hoy',
    modulo: 'programacion_cea',
    saludo: 'Operación — clases CEA programadas para hoy.',
    tips: [
      {
        id: 'cea-t-1',
        titulo: 'Lista del día',
        cuerpo:
          'Teoría, taller y práctica en una vista. Estado: pendiente, en curso, finalizada.',
      },
      {
        id: 'cea-t-2',
        titulo: 'Control operativo',
        cuerpo:
          'Use antes de iniciar jornada académica para verificar salas, vehículos e instructores.',
      },
      {
        id: 'cea-t-3',
        titulo: 'Alertas vinculadas',
        cuerpo:
          'Clase próxima a iniciar genera alerta parpadeante en encabezado con enlace rápido.',
      },
    ],
  },
  'instructores.hub': {
    id: 'instructores.hub',
    modulo: 'instructores',
    saludo: 'Gestión y portal de instructores.',
    tips: [
      {
        id: 'inst-h-1',
        titulo: 'Mi portal',
        cuerpo:
          'Instructor ve clases, alertas y tareas propias. Admin ve listado completo.',
      },
      {
        id: 'inst-h-2',
        titulo: 'Documentos instructor',
        cuerpo:
          'Licencia, certificados médicos, etc. Vencimiento genera alertas como en vehículos.',
      },
      {
        id: 'inst-h-3',
        titulo: 'Vínculo RRHH',
        cuerpo:
          'Cada instructor es empleado. Datos laborales en RRHH; operación académica aquí y en Programación CEA.',
      },
    ],
  },
  'instructores.detalle': {
    id: 'instructores.detalle',
    modulo: 'instructores',
    saludo: 'Ficha detallada del instructor.',
    tips: [
      {
        id: 'inst-d-1',
        titulo: 'Datos operativos',
        cuerpo:
          'Categorías que puede enseñar, sede, contacto. Coherente con licencias en RRHH.',
      },
      {
        id: 'inst-d-2',
        titulo: 'Agenda',
        cuerpo:
          'Clases CEA y jornadas asignadas. No elimine instructor con clases futuras sin reasignar.',
      },
      {
        id: 'inst-d-3',
        titulo: 'Alertas portal',
        cuerpo:
          'Documentos por vencer o clases sin asistencia registrada pueden notificarse al instructor.',
      },
    ],
  },
};
