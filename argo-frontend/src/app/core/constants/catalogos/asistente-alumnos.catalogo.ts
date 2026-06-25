import type { AsistenteContexto } from '../asistente.types';

export const ASISTENTE_ALUMNOS: Record<string, AsistenteContexto> = {
  'alumnos.lista': {
    id: 'alumnos.lista',
    modulo: 'alumnos',
    saludo: 'Listado general de alumnos del CEA.',
    tips: [
      {
        id: 'al-list-ctx',
        titulo: 'Contexto de esta pantalla',
        cuerpo:
          'Listado completo con datos personales, contacto y ubicación. Pulse un encabezado de columna para ordenar; vuelva a pulsar para invertir el orden.',
      },
      {
        id: 'al-list-1',
        titulo: 'Barra de búsqueda',
        cuerpo:
          'Filtra por número de documento o parte del nombre. La búsqueda es incremental: escriba y la tabla se reduce sin recargar toda la página.',
      },
      {
        id: 'al-list-2',
        titulo: 'Columnas ordenables',
        cuerpo:
          'Clic en el encabezado de columna ordena ascendente/descendente. Útil para encontrar deudores (saldo), vencimientos o alumnos recientes.',
      },
      {
        id: 'al-list-3',
        titulo: 'Filas con alerta (parpadeo)',
        cuerpo:
          'Una fila que parpadea indica condición especial: saldo pendiente, documentos vencidos, certificado por vencer u otra alerta de negocio. Entre al detalle para resolver.',
      },
      {
        id: 'al-list-4',
        titulo: 'Avatar / iniciales',
        cuerpo:
          'Identificación visual rápida. El color no tiene significado fiscal; solo ayuda a ubicar al alumno en la lista.',
      },
      {
        id: 'al-list-5',
        titulo: 'Botón Nuevo alumno',
        cuerpo:
          'Crea ficha vacía. Requiere permiso alumnos.gestionar. El numDoc (documento) debe ser único en todo ARGO.',
      },
      {
        id: 'al-list-6',
        titulo: 'Clic en fila',
        cuerpo:
          'Abre la ficha completa con pestañas: Datos, Servicios, Pagos, Certificados, Documentos y Programación CEA (si aplica).',
      },
      {
        id: 'al-list-7',
        titulo: 'Jornada en la lista',
        cuerpo:
          'Si aparece jornada vinculada, el alumno está inscrito en capacitación grupal. Detalle en módulo Jornadas o en su ficha.',
      },
    ],
  },
  'alumnos.lista.jornadas': {
    id: 'alumnos.lista.jornadas',
    modulo: 'alumnos',
    saludo: 'Alumnos filtrados para jornadas de capacitación.',
    tips: [
      {
        id: 'al-jor-l-ctx',
        titulo: 'Contexto de esta pantalla',
        cuerpo:
          'Solo alumnos con tipo Jornadas de Capacitación. Pulse un encabezado de columna para ordenar.',
      },
      {
        id: 'al-jor-l-1',
        titulo: 'Modo jornadas',
        cuerpo:
          'Esta vista es la misma lista de alumnos pero accedida desde Jornadas. Sirve para inscribir o consultar participantes de cursos grupales.',
      },
      {
        id: 'al-jor-l-2',
        titulo: 'Inscripción',
        cuerpo:
          'Desde la jornada concreta (módulo Jornadas) se agregan alumnos a cupos. Aquí solo busca y abre la ficha.',
      },
    ],
  },
  'alumnos.nuevo': {
    id: 'alumnos.nuevo',
    modulo: 'alumnos',
    saludo: 'Creación de alumno nuevo — datos mínimos obligatorios.',
    tips: [
      {
        id: 'al-new-1',
        titulo: 'Tipo de documento',
        cuerpo:
          'CC, TI, CE, NIT, etc. Define formatos en certificados y facturación. No lo cambie a la ligera después de emitir documentos oficiales.',
      },
      {
        id: 'al-new-2',
        titulo: 'Número de documento (numDoc)',
        cuerpo:
          'Llave única del alumno en ARGO. Si ya existe, el sistema rechazará el duplicado — busque en la lista y edite.',
      },
      {
        id: 'al-new-3',
        titulo: 'Nombres y apellidos',
        cuerpo:
          'Deben coincidir con documento de identidad. Se usan en recibos, certificados y factura electrónica (adquirente alumno).',
      },
      {
        id: 'al-new-4',
        titulo: 'Guardar antes de matricular',
        cuerpo:
          'Primero guarde Datos principales; luego vaya a Servicios para matricular programas o ítems. Sin liquidación no hay qué cobrar.',
      },
      {
        id: 'al-new-5',
        titulo: 'Sede',
        cuerpo:
          'Si opera multi-sede, asigne sede principal del alumno. Afecta numeración, reportes y disponibilidad de programas.',
      },
    ],
  },
  'alumnos.detalle.datos': {
    id: 'alumnos.detalle.datos',
    modulo: 'alumnos',
    saludo: 'Datos principales — identidad, contacto y perfil del alumno.',
    tips: [
      {
        id: 'al-dat-1',
        titulo: 'Encabezado de la ficha',
        cuerpo:
          'Muestra nombre, documento y alertas (saldo, certificados, documentos). Las pestañas debajo agrupan operaciones: no mezcle pagos con datos personales.',
      },
      {
        id: 'al-dat-2',
        titulo: 'Tipo y número de documento',
        cuerpo:
          'Identificador fiscal y académico. Cambiar numDoc en alumno existente es delicado: puede afectar historial. Consulte admin si hubo error de digitación grave.',
      },
      {
        id: 'al-dat-3',
        titulo: 'Fecha de nacimiento y edad',
        cuerpo:
          'Validaciones de edad mínima para ciertos servicios (licencias). Alimenta reportes demográficos.',
      },
      {
        id: 'al-dat-4',
        titulo: 'Correo y celular',
        cuerpo:
          'Contacto operativo. Factus puede enviar factura al correo del adquirente si está configurado.',
      },
      {
        id: 'al-dat-5',
        titulo: 'Dirección y municipio',
        cuerpo:
          'Municipio usa catálogo DANE (combobox con búsqueda). Código correcto exige DIAN en facturación y algunos certificados.',
      },
      {
        id: 'al-dat-6',
        titulo: 'EPS, régimen, ocupación',
        cuerpo:
          'Catálogos configurables. Útiles para reportes RUNT y estadísticas; no mueven dinero.',
      },
      {
        id: 'al-dat-7',
        titulo: 'Estado civil, discapacidad, nivel formación',
        cuerpo:
          'Campos demográficos opcionales según política del CEA. Aparecen en exportaciones si están diligenciados.',
      },
      {
        id: 'al-dat-8',
        titulo: 'Botón Guardar',
        cuerpo:
          'Persiste cambios en MongoDB. Si ve alerta amarilla parpadeando, hay cambios sin guardar. Cambiar de pestaña sin guardar puede perder edición.',
      },
      {
        id: 'al-dat-9',
        titulo: 'Programa / jornada vinculada',
        cuerpo:
          'Si el alumno está en un programa académico o jornada, puede verse aquí o en Servicios. La matrícula formal está en pestaña Servicios.',
      },
    ],
  },
  'alumnos.detalle.servicios': {
    id: 'alumnos.detalle.servicios',
    modulo: 'alumnos',
    saludo: 'Servicios matriculados y liquidaciones (deuda por ítem).',
    tips: [
      {
        id: 'al-srv-1',
        titulo: '¿Qué es una liquidación?',
        cuerpo:
          'Cada servicio matriculado genera una liquidación = compromiso de pago por ese ítem (curso, RUNT, examen…). Valor, saldo y estado viven aquí.',
      },
      {
        id: 'al-srv-2',
        titulo: 'Valor vs saldo',
        cuerpo:
          'Valor = precio total del servicio. Saldo = lo que falta por pagar. Los ingresos en Pagos reducen saldo; la factura electrónica NO.',
      },
      {
        id: 'al-srv-3',
        titulo: 'Matricular servicio o programa',
        cuerpo:
          'Agregar crea liquidación con tarifa vigente del catálogo (puede variar por sede/programa). Verifique servicio correcto antes de confirmar.',
      },
      {
        id: 'al-srv-4',
        titulo: 'Facturar SI / NO (catálogo servicios)',
        cuerpo:
          'Se define en Servicios (admin). Solo ítems con Facturar=SI entran a facturación electrónica en Pagos.',
      },
      {
        id: 'al-srv-5',
        titulo: 'IVA del servicio',
        cuerpo:
          'Condición gravado/exento/excluido y % IVA vienen del catálogo. ARGO desglosa IVA del valor si está configurado «incluye IVA».',
      },
      {
        id: 'al-srv-6',
        titulo: 'Anular o retirar matrícula',
        cuerpo:
          'Reglas dependen de pagos ya hechos y certificados emitidos. Anular no borra ingresos históricos; puede dejar saldo a favor pendiente de trámite.',
      },
      {
        id: 'al-srv-7',
        titulo: 'Relación con certificados',
        cuerpo:
          'Algunos certificados exigen servicio «cumplido» y pagos al día. Si no puede certificar, revise saldo aquí y requisitos en Documentos.',
      },
      {
        id: 'al-srv-8',
        titulo: 'Relación con Programación CEA',
        cuerpo:
          'Prácticas y clases teóricas consumen servicios de formación. Sin matrícula del servicio correcto no podrá inscribir clases.',
      },
    ],
  },
  'alumnos.detalle.pagos': {
    id: 'alumnos.detalle.pagos',
    modulo: 'alumnos',
    saludo: 'Cobros, recibos y facturación electrónica del alumno.',
    tips: [
      {
        id: 'pag-1',
        titulo: 'Tarjetas Total liquidado / pagado / saldo',
        cuerpo:
          'Resumen financiero del alumno. Total liquidado = suma servicios. Total pagado = ingresos registrados. Saldo = diferencia. Solo ingresos mueven saldo.',
      },
      {
        id: 'pag-2',
        titulo: 'Registrar pago — liquidación',
        cuerpo:
          'Elija qué deuda abona. Puede ser abono parcial. El valor no puede superar saldo de esa liquidación (salvo reglas especiales).',
      },
      {
        id: 'pag-3',
        titulo: 'Registrar pago — forma y valor',
        cuerpo:
          'Efectivo, transferencia, etc. según catálogo. Requiere caja abierta si su rol es cajero. Genera recibo con consecutivo.',
      },
      {
        id: 'pag-4',
        titulo: 'Recibo de ingreso',
        cuerpo:
          'Comprobante no fiscal (distinto de factura electrónica). Reimprima desde historial. Anular ingreso revierte abono (permiso admin).',
      },
      {
        id: 'pag-5',
        titulo: 'Emitir factura electrónica',
        cuerpo:
          'Manual. Requisitos: al menos un abono, servicio Facturar=SI, sin FE activa previa para esas liquidaciones. Puede agrupar varios ítems en una factura.',
      },
      {
        id: 'pag-6',
        titulo: 'Factura a crédito',
        cuerpo:
          'Si factura el valor total del servicio pero aún hay saldo, DIAN recibe forma de pago crédito. El saldo en ARGO sigue igual hasta nuevos pagos.',
      },
      {
        id: 'pag-7',
        titulo: 'Adquirente tercero',
        cuerpo:
          'En el modal puede facturar a cliente del catálogo (empresa que paga por el alumno). Créelo en Configuración → Clientes facturación.',
      },
      {
        id: 'pag-8',
        titulo: 'Historial de pagos — columnas',
        cuerpo:
          'Fecha, recibo, liquidación, valor, usuario. Sirve para auditoría y reimpresión. Cruce con caja en módulo Flujo de caja.',
      },
      {
        id: 'pag-9',
        titulo: 'Alertas de saldo',
        cuerpo:
          'Saldo pendiente puede activar parpadeo en ficha y listado. Cobro en caja también puede hacerse desde Cobros pendientes.',
      },
    ],
  },
  'alumnos.detalle.certificados': {
    id: 'alumnos.detalle.certificados',
    modulo: 'alumnos',
    saludo: 'Emisión y consulta de certificados del alumno.',
    tips: [
      {
        id: 'al-cert-1',
        titulo: 'Tipos de certificado',
        cuerpo:
          'Cada tipo (asistencia, aprobación teórica, jornada, etc.) tiene plantilla en Configuración → Certificados. Consecutivo automático por tipo/sede.',
      },
      {
        id: 'al-cert-2',
        titulo: 'Emitir certificado',
        cuerpo:
          'Valida requisitos: pagos, documentos, horas CEA o jornada cumplida. Si falla, el mensaje indica qué falta.',
      },
      {
        id: 'al-cert-3',
        titulo: 'Fecha de expedición y vencimiento',
        cuerpo:
          'Vencimiento alimenta alertas del encabezado (certificados por vencer / vencidos). Renovación = nuevo trámite según norma.',
      },
      {
        id: 'al-cert-4',
        titulo: 'Imprimir / PDF',
        cuerpo:
          'Usa layout configurado (logos, campos dinámicos). Preview antes de imprimir si el tipo lo permite.',
      },
      {
        id: 'al-cert-5',
        titulo: 'Anular certificado',
        cuerpo:
          'No borra el registro: marca anulado para auditoría. Puede requerir permiso especial.',
      },
      {
        id: 'al-cert-6',
        titulo: 'Certificados vs factura',
        cuerpo:
          'Certificado académico ≠ factura fiscal. Son procesos independientes en ARGO.',
      },
    ],
  },
  'alumnos.detalle.documentos': {
    id: 'alumnos.detalle.documentos',
    modulo: 'alumnos',
    saludo: 'Expediente documental del alumno.',
    tips: [
      {
        id: 'al-doc-1',
        titulo: 'Lista de requisitos',
        cuerpo:
          'Ítems definidos en Configuración → Requisitos alumnos. Cada uno: recibido sí/no, fecha, vencimiento, observación.',
      },
      {
        id: 'al-doc-2',
        titulo: 'Semáforo de cumplimiento',
        cuerpo:
          'Verde = OK, amarillo = por vencer, rojo = falta o vencido. Bloquea certificados o exámenes según reglas.',
      },
      {
        id: 'al-doc-3',
        titulo: 'Adjuntos',
        cuerpo:
          'Si el módulo permite archivo, guarde soporte escaneado. Tamaño y formato según política del CEA.',
      },
      {
        id: 'al-doc-4',
        titulo: 'Documentos y RUNT',
        cuerpo:
          'Trámites ante RUNT suelen exigir documentos completos aquí antes de marcar servicios como listos.',
      },
    ],
  },
  'alumnos.detalle.programacion': {
    id: 'alumnos.detalle.programacion',
    modulo: 'alumnos',
    saludo: 'Clases CEA asignadas al alumno (teoría, taller, práctica).',
    tips: [
      {
        id: 'al-cea-1',
        titulo: 'Inscripción a clase',
        cuerpo:
          'Consume cupo del horario programado en Programación CEA. Alumno debe tener servicio matriculado compatible.',
      },
      {
        id: 'al-cea-2',
        titulo: 'Asistencia',
        cuerpo:
          'La registra instructor o coordinador. Horas cumplidas alimentan certificados y alertas de clases pendientes.',
      },
      {
        id: 'al-cea-3',
        titulo: 'Prácticas en vehículo',
        cuerpo:
          'Requieren vehículo disponible, documentos al día e instructor asignado. Conflictos de agenda los muestra el calendario CEA.',
      },
      {
        id: 'al-cea-4',
        titulo: 'Desinscribir',
        cuerpo:
          'Libera cupo para otro alumno. No reembolsa automáticamente: devoluciones son trámite de caja aparte.',
      },
      {
        id: 'al-cea-5',
        titulo: 'Alertas CEA en encabezado',
        cuerpo:
          'Clases sin programar, próximas o con alumnos pendientes generan franjas parpadeantes arriba.',
      },
    ],
  },
};
