import { UpperCasePipe } from '@angular/common';
import { Component } from '@angular/core';
import { resolveAppLoginUrl } from '../../core/utils/app-login-url.util';
import { MatrixLoginBgComponent } from '../../shared/matrix-login-bg/matrix-login-bg.component';

type Accent = 'blue' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'teal';

interface ValorPromo {
  titulo: string;
  texto: string;
  accent: Accent;
}

interface PasoCiclo {
  numero: string;
  titulo: string;
  texto: string;
}

interface ModuloDetalle {
  id: string;
  titulo: string;
  subtitulo: string;
  parrafos: string[];
  bullets: string[];
  accent: Accent;
  imagen: string;
  imagenAlt: string;
  video?: string;
}

interface CertificadoTipo {
  id: string;
  nombre: string;
  uso: string;
}

interface GaleriaItem {
  titulo: string;
  desc: string;
  imagen: string;
  accent: Accent;
}

interface VideoPromo {
  titulo: string;
  desc: string;
  detalle: string;
  src: string;
  poster: string;
}

@Component({
  selector: 'argo-home',
  standalone: true,
  imports: [UpperCasePipe, MatrixLoginBgComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly loginUrl = resolveAppLoginUrl();
  readonly anio = new Date().getFullYear();
  readonly whatsappUrl = 'https://wa.me/573162835974';
  readonly email = 'walteraaguilar@hotmail.com';
  readonly desarrollador = 'Walter Alexander Aguilar';
  readonly videoAccents: Accent[] = ['blue', 'violet', 'cyan', 'emerald', 'amber', 'teal'];

  /**
   * Sube este número cuando reemplaces archivos en public/imagenes o public/videos
   * (fuerza al navegador a pedir la versión nueva). No hace falta tocar cada archivo.
   */
  private readonly publicMediaVersion = 4;

  /** URL absoluta desde public/ — todas las imágenes y videos pasan por aquí. */
  mediaUrl(path: string | undefined | null): string {
    if (!path) return '';
    const clean = String(path).replace(/^\//, '').split('?')[0];
    return `/${clean}?v=${this.publicMediaVersion}`;
  }

  readonly valores: ValorPromo[] = [
    {
      titulo: 'Hecho para CEAs colombianos',
      texto:
        'Flujos reales: matrícula Regular, Jornadas de capacitación empresarial, categorías de licencia, tarifas múltiples y normativa local — no un ERP genérico adaptado a la fuerza.',
      accent: 'blue',
    },
    {
      titulo: 'Un solo expediente por alumno',
      texto:
        'Datos personales, documentos, servicios contratados, pagos, certificados, programación CEA e historial fiscal en una ficha continua, sin duplicar información.',
      accent: 'cyan',
    },
    {
      titulo: 'Control financiero y fiscal',
      texto:
        'Caja por turno con arqueo, cierres, descuadres, recibos configurables y facturación electrónica DIAN con notas crédito cuando el negocio lo exige.',
      accent: 'emerald',
    },
    {
      titulo: 'Alarmas inteligentes — innovación ARGO',
      texto:
        'Franjas parpadeantes en el encabezado que avisan lo urgente antes de que sea tarde: caja cerrada, certificados por vencer, documentos de flota e instructores, clases CEA próximas, inspección preoperacional pendiente y más. Cada rol recibe solo las suyas.',
      accent: 'amber',
    },
    {
      titulo: 'Multi-sede real',
      texto:
        'Varias sedes (Principal, sucursales, puntos de atención): sede activa en la barra superior, datos filtrados por usuario, consecutivos y oferta de programas/servicios por sede.',
      accent: 'violet',
    },
    {
      titulo: 'Permisos finos por rol',
      texto:
        'Roles personalizables (cajero, recepción, instructor, admin): cada usuario ve solo lo que le corresponde, con auditoría de acciones sensibles.',
      accent: 'amber',
    },
    {
      titulo: 'Mia — ayudante interactivo',
      texto:
        'Ayuda contextual en cada pantalla: Mia detecta dónde estás y explica campos, botones y reglas con tips navegables — capacita al personal sin manual impreso.',
      accent: 'teal',
    },
  ];

  readonly cicloOperativo: PasoCiclo[] = [
    {
      numero: '01',
      titulo: 'Prospecto y matrícula',
      texto: 'Registra al alumno, valida documentos requeridos y matricula programas o servicios con liquidación automática.',
    },
    {
      numero: '02',
      titulo: 'Cobro y caja',
      texto: 'Abonos parciales o totales, recibo de ingreso, turno de caja, arqueo y cierre con trazabilidad por cajero.',
    },
    {
      numero: '03',
      titulo: 'Formación y práctica',
      texto: 'Programación CEA (teoría, taller, práctica), portal del instructor, asistencia y rastreo del avance académico.',
    },
    {
      numero: '04',
      titulo: 'Certificación',
      texto: 'Emisión de certificados elegibles (pagados y documentos completos) con plantilla por tipo y consecutivo por sede.',
    },
    {
      numero: '05',
      titulo: 'Documento fiscal',
      texto: 'Factura electrónica desde pagos del alumno, clientes FE, PDF con QR DIAN y notas crédito total o parcial.',
    },
  ];

  readonly modulosDetalle: ModuloDetalle[] = [
    {
      id: 'alumnos',
      titulo: 'Alumnos, matrículas y cartera',
      subtitulo: 'El corazón operativo del CEA',
      parrafos: [
        'La ficha del alumno concentra identificación, datos de contacto, municipio georreferenciado, tipo de capacitación (Regular o Jornadas), categoría de licencia y estado del expediente.',
        'Desde la misma pantalla gestionas servicios matriculados, liquidaciones con saldo, abonos, certificados emitidos, documentos escaneados y la programación CEA asignada.',
      ],
      bullets: [
        'Lista con búsqueda por nombre, documento y filtros por sede o jornada',
        'OCR de cédula para agilizar el registro',
        'Pestañas: datos, servicios, pagos, certificados, documentos, programación',
        'Validación de documentos obligatorios antes de certificar',
        'Indicadores de cartera y estado académico',
      ],
      accent: 'blue',
      imagen: 'imagenes/modulo-alumnos.jpg',
      imagenAlt: 'Captura del módulo de alumnos ARGO',
      video: 'videos/modulo-alumnos.mp4',
    },
    {
      id: 'sedes',
      titulo: 'Sedes y operación multi-sede',
      subtitulo: 'Un CEA, varias ubicaciones — un solo sistema',
      parrafos: [
        'ARGO está pensado para centros con más de un punto de atención: sede Principal, sucursales o sedes de práctica. Cada sede tiene datos propios (dirección, municipio, contacto) y reglas de qué programas y servicios puede ofrecer.',
        'El usuario elige la sede activa en la barra superior; listados, matrículas, caja, programación CEA, certificados y facturación respetan ese contexto. Quienes tienen permiso ven todas las sedes; el resto solo las asignadas a su usuario o empleado.',
      ],
      bullets: [
        'Alta y edición de sedes con georreferenciación (municipio DANE, mapa)',
        'Sede activa visible en encabezado — reportes y consecutivos dependen de ella',
        'Consecutivos de recibos y certificados configurables por sede',
        'Oferta de programas y servicios: todos, por tipo o catálogo específico por sede',
        'Usuario / empleado vinculado a sede principal y sedes permitidas',
        'Permiso sedes.ver_todas para administradores y supervisores',
        'Encabezados de recibos e impresos con datos de la sede correspondiente',
      ],
      accent: 'violet',
      imagen: 'imagenes/modulo-sedes.jpg',
      imagenAlt: 'Configuración de sedes y selector de sede activa en ARGO',
      video: 'videos/modulo-sedes.mp4',
    },
    {
      id: 'alarmas',
      titulo: 'Alarmas inteligentes en el encabezado',
      subtitulo: 'El sistema te avisa — no tienes que buscar el problema',
      parrafos: [
        'Uno de los diferenciales de ARGO es el motor de alarmas: bandas visibles en la cabecera de la aplicación que parpadean cuando hay algo pendiente de acción. No es un reporte que abres después: es una señal en tiempo real mientras operas.',
        'Cada alarma está ligada a reglas de negocio concretas (caja sin abrir, SOAT por vencer, clase en 15 minutos, alumno con saldo pendiente…) y se configura por rol en Configuración → Roles: el cajero ve las de caja, el instructor las de portal y práctica, recepción las académicas, el admin todas.',
      ],
      bullets: [
        'Caja: turno cerrado, cobro sin caja abierta, descuadres pendientes',
        'Certificados: por vencer (15 días antes) y vencidos (3 días después)',
        'Vehículos: documentos vencidos/faltantes e inspección preop. del día sin registrar',
        'Empleados / instructores: documentos vencidos o requeridos sin cargar',
        'Programación CEA: horas sin programar, clase próxima (15 min), clases en estado CREADO',
        'Portal instructor: clase asignada, clase en 20 min, inspección antes de primera práctica',
        'Jornadas: EN PROCESO hoy, certificado recién emitido, toast al crear clases',
        'Alumnos: saldos, documentos pendientes y clases CEA por programar',
        'Clic en la franja lleva al módulo correspondiente — acción directa',
        'Catálogo extensible; administrador puede activar/desactivar alarmas por rol',
      ],
      accent: 'amber',
      imagen: 'imagenes/modulo-alarmas.jpg',
      imagenAlt: 'Franjas de alarmas parpadeantes en el encabezado de ARGO',
      video: 'videos/modulo-alarmas.mp4',
    },
    {
      id: 'caja',
      titulo: 'Caja, ingresos, egresos y cierres',
      subtitulo: 'Control del dinero por turno',
      parrafos: [
        'ARGO modela la caja como un turno: apertura, movimientos, arqueo y cierre. Cada ingreso genera comprobante con numeración configurable; los egresos quedan auditados.',
        'Administración avanzada: listados globales de ingresos y egresos, descuadres detectados, cierre general multi-caja e informes imprimibles para contabilidad.',
      ],
      bullets: [
        'Banner de caja cerrada con alerta en el encabezado',
        'Cobros pendientes centralizados',
        'Recibos de ingreso y egreso con plantilla editable',
        'Cuadre, cierres por sesión y cierre general',
        'Permisos separados: cajero vs administrador de caja',
      ],
      accent: 'cyan',
      imagen: 'imagenes/modulo-caja.jpg',
      imagenAlt: 'Captura del módulo de caja ARGO',
      video: 'videos/modulo-caja.mp4',
    },
    {
      id: 'certificados',
      titulo: 'Certificados académicos',
      subtitulo: 'Plantillas por tipo de formación',
      parrafos: [
        'Emite certificados solo cuando el alumno cumple reglas de negocio: servicios pagados, documentos al día y tipo de certificado coherente con el programa.',
        'Editor visual de layout por tipo (curso, licencia, mercancías peligrosas, jornada empresarial, etc.) con campos dinámicos, QR y consecutivo automático.',
      ],
      bullets: [
        'Tipos: curso, técnico, competencias, diplomado, licencia, MP, jornada',
        'Listado global de certificados con alertas de vencimiento',
        'Certificado automático al cerrar jornada empresarial',
        'Impresión y reimpresión controlada',
        'Configuración por sede y prefijo',
      ],
      accent: 'emerald',
      imagen: 'imagenes/modulo-certificados.jpg',
      imagenAlt: 'Captura de certificados ARGO',
    },
    {
      id: 'cea',
      titulo: 'Programación CEA',
      subtitulo: 'Teoría, taller y práctica en calendario',
      parrafos: [
        'Planifica clases por sede, instructor y vehículo. Visualiza el calendario operativo, clases del día, pendientes por programar y el avance de cada alumno en su malla.',
        'Integración con instructores: portal propio, inspección preoperacional del vehículo antes de salir a vía, y alertas cuando una clase está por iniciar o quedó sin asignar.',
      ],
      bullets: [
        'Hub de programación con indicadores y clases de hoy',
        'Planificación automática y rastreo por alumno',
        'Teoría / taller / práctica con reglas de negocio CEA',
        'Alertas de clase próxima y clase recién creada',
        'Vista alumno en pestaña Programación',
      ],
      accent: 'amber',
      imagen: 'imagenes/modulo-cea.jpg',
      imagenAlt: 'Captura de programación CEA ARGO',
      video: 'videos/modulo-cea.mp4',
    },
    {
      id: 'jornadas',
      titulo: 'Jornadas de capacitación empresarial',
      subtitulo: 'Contratos, carpas y asistencia',
      parrafos: [
        'Gestiona empresas contratantes, contratos, jornadas en campo, listas de alumnos por jornada, mapa de ubicación y certificado de asistencia generado al cerrar.',
        'Flujo pensado para capacitación en sitio: instructores, fechas, carpas, asistencia por clase y emisión masiva de certificados de jornada.',
      ],
      bullets: [
        'Hub de jornadas con accesos rápidos',
        'Editor de clases con mapa',
        'Certificado automático al finalizar jornada',
        'Lista de alumnos por jornada Cap.',
        'Integración con módulo de certificados',
      ],
      accent: 'violet',
      imagen: 'imagenes/modulo-jornadas.jpg',
      imagenAlt: 'Captura de jornadas ARGO',
      video: 'videos/modulo-jornadas.mp4',
    },
    {
      id: 'vehiculos',
      titulo: 'Vehículos e inspección preoperacional',
      subtitulo: 'Flota documentada y lista para la vía',
      parrafos: [
        'Registra placa, categoría, documentos (SOAT, tecnomecánica, contractual) con alertas de vencimiento visibles en listados y encabezado del sistema.',
        'Formato de inspección preoperacional configurable. El instructor completa el checklist diario; ARGO conserva historial y consecutivo por vehículo.',
      ],
      bullets: [
        'Alertas documentales en franjas del topbar',
        'Inspección con ítems del catálogo preop',
        'Impresión de formato de inspección',
        'Asignación a clases de práctica',
        'Requisitos documentales por tipo de vehículo',
      ],
      accent: 'teal',
      imagen: 'imagenes/modulo-vehiculos.jpg',
      imagenAlt: 'Captura de vehículos ARGO',
      video: 'videos/modulo-vehiculos.mp4',
    },
    {
      id: 'instructores',
      titulo: 'Instructores y portal',
      subtitulo: 'Mis clases, inspección y operación en vía',
      parrafos: [
        'Hub de instructores vinculado a empleados y usuarios del sistema. El portal permite ver clases asignadas, registrar inspección del vehículo y operar sin acceder a módulos administrativos.',
        'Alertas dedicadas cuando el instructor tiene pendientes operativos el mismo día de la práctica.',
      ],
      bullets: [
        'Portal «Mis clases» con permiso propio',
        'Inspección preoperacional desde móvil/tablet en LAN',
        'Vinculación empleado ↔ usuario ARGO',
        'Listado admin de instructores activos',
        'Alarmas en encabezado para instructores',
      ],
      accent: 'blue',
      imagen: 'imagenes/modulo-instructores.jpg',
      imagenAlt: 'Captura del portal instructor ARGO',
      video: 'videos/modulo-instructores.mp4',
    },
    {
      id: 'facturacion',
      titulo: 'Facturación electrónica DIAN',
      subtitulo: 'Documento fiscal alineado con los cobros',
      parrafos: [
        'Emite factura electrónica manual desde pagos del alumno: selección de ítems liquidados, adquirente (alumno o cliente FE), cálculo de IVA desglosado y representación impresa con QR.',
        'Hub de facturas, notas crédito total/parcial, clientes con datos DIAN, configuración Factus o modo desarrollo, y PDF listo para entregar al adquirente.',
      ],
      bullets: [
        'Multi-ítem por factura desde liquidaciones abonadas',
        'Notas crédito con anulación fiscal',
        'Catálogo de clientes para facturar a terceros',
        'Configuración régimen, IVA y numeración',
        'Ver / PDF con CUFE y QR DIAN',
      ],
      accent: 'cyan',
      imagen: 'imagenes/modulo-facturacion.jpg',
      imagenAlt: 'Captura de facturación ARGO',
      video: 'videos/modulo-facturacion.mp4',
    },
    {
      id: 'mia',
      titulo: 'Mia — ayudante interactivo',
      subtitulo: 'Ayuda contextual según la pantalla',
      parrafos: [
        'Mia es el asistente flotante de ARGO. Al cambiar de módulo o pantalla, el contenido de ayuda se adapta: saludo del contexto, etiqueta del área y tips sobre la lógica de negocio de lo que estás viendo.',
        'Panel abajo a la derecha con recorrido interactivo (‹ ›) entre temas, sonido opcional y opción de ocultar o reactivar cuando el usuario lo necesite. Pensado para capacitar recepción, caja, académico e instructores en el puesto de trabajo.',
      ],
      bullets: [
        'Catálogo por pantalla: alumnos, caja, CEA, jornadas, vehículos, facturación, config…',
        'Tips con título y explicación de campos, botones y flujos',
        'Indicador «N de M temas» y navegación entre tips',
        'Icono flotante siempre visible; minimizar u ocultar panel',
        'Sin salir del flujo: ayuda mientras operas el sistema',
        'Extensible: nuevas pantallas suman contexto al catálogo',
      ],
      accent: 'violet',
      imagen: 'imagenes/modulo-mia.jpg',
      imagenAlt: 'Panel del asistente Mia en ARGO',
      video: 'videos/modulo-mia.mp4',
    },
    {
      id: 'rrhh',
      titulo: 'RRHH y nómina',
      subtitulo: 'Personal, contratos y liquidación de nómina',
      parrafos: [
        'Gestiona empleados e instructores: datos laborales, contratos, EPS, documentos escaneados y vinculación con usuario ARGO para acceso al sistema o al portal del instructor.',
        'Nómina por períodos con novedades, deducciones y parámetros legales configurables. Alertas de documentos vencidos o faltantes en el encabezado, igual que en flota vehicular.',
      ],
      bullets: [
        'Alta y edición de empleados con historial documental',
        'Vinculación empleado ↔ usuario (rol instructor, cajero, etc.)',
        'Períodos de nómina, novedades y liquidación',
        'Parámetros legales y de deducción configurables',
        'Alertas documentales de instructores y personal',
        'Hub RRHH con accesos a empleados y nómina',
      ],
      accent: 'cyan',
      imagen: 'imagenes/modulo-rrhh.jpg',
      imagenAlt: 'Captura de RRHH y nómina ARGO',
    },
    {
      id: 'configuracion',
      titulo: 'Configuración del CEA',
      subtitulo: 'Usuarios, roles, catálogos y parámetros del sistema',
      parrafos: [
        'Módulo de configuración extenso: usuarios, roles con permisos granulares y alarmas por rol, recibos, certificados, programas, servicios, georreferenciación DANE y requisitos documentales.',
        'Auditoría de acciones sensibles, monitor técnico del servidor y dashboard ejecutivo con KPIs. Las sedes tienen bloque propio (ver arriba).',
      ],
      bullets: [
        'Roles: admin, cajero, recepción, instructor, personalizado',
        'Editor de roles: permisos + alarmas activas por rol',
        'Programas y servicios con tarifas 1/2/3 e IVA',
        'Plantillas de recibos, certificados e inspección vehicular',
        'Catálogos, municipios DANE y requisitos documentales',
        'Dashboard ejecutivo con KPIs',
        'Auditoría de cambios sensibles',
      ],
      accent: 'emerald',
      imagen: 'imagenes/modulo-config.jpg',
      imagenAlt: 'Captura de configuración ARGO',
      video: 'videos/modulo-config.mp4',
    },
  ];

  readonly certificadosTipos: CertificadoTipo[] = [
    { id: 'curso', nombre: 'Curso', uso: 'Capacitación no formal y cursos libres del CEA.' },
    { id: 'tecnico', nombre: 'Técnico laboral', uso: 'Programas técnicos con malla definida.' },
    { id: 'competencias', nombre: 'Competencias', uso: 'Certificación por competencias laborales.' },
    { id: 'diplomado', nombre: 'Diplomado', uso: 'Programas de diplomado especializado.' },
    { id: 'licencia', nombre: 'Licencia de conducción', uso: 'Formación para trámite de licencia.' },
    { id: 'mp', nombre: 'Mercancías peligrosas', uso: 'Transporte de mercancías peligrosas.' },
    { id: 'jornada', nombre: 'Jornada empresarial', uso: 'Capacitación en empresa contratante.' },
  ];

  readonly galeria: GaleriaItem[] = [
    { titulo: 'Dashboard ejecutivo', desc: 'KPIs y resumen financiero del CEA.', imagen: 'imagenes/galeria-dashboard.jpg', accent: 'blue' },
    { titulo: 'Selector de sedes', desc: 'Multi-sede y filtro por ubicación.', imagen: 'imagenes/galeria-sedes.jpg', accent: 'violet' },
    { titulo: 'Alarmas en encabezado', desc: 'Franjas parpadeantes por rol.', imagen: 'imagenes/galeria-alarmas.jpg', accent: 'amber' },
    { titulo: 'Ficha del alumno', desc: 'Expediente completo en pestañas.', imagen: 'imagenes/galeria-alumno.jpg', accent: 'cyan' },
    { titulo: 'Calendario CEA', desc: 'Clases, instructores y vehículos.', imagen: 'imagenes/galeria-cea.jpg', accent: 'emerald' },
    { titulo: 'Turno de caja', desc: 'Ingresos, arqueo y cierre.', imagen: 'imagenes/galeria-caja.jpg', accent: 'amber' },
    { titulo: 'Certificado emitido', desc: 'Plantilla con QR y consecutivo.', imagen: 'imagenes/galeria-certificado.jpg', accent: 'violet' },
    { titulo: 'Factura electrónica', desc: 'PDF con QR DIAN.', imagen: 'imagenes/galeria-factura.jpg', accent: 'teal' },
    { titulo: 'Asistente Mia', desc: 'Ayuda interactiva según pantalla.', imagen: 'imagenes/galeria-mia.jpg', accent: 'violet' },
  ];

  readonly videos: VideoPromo[] = [
    {
      titulo: 'Presentación general ARGO',
      desc: 'Visión del producto en 3–5 minutos.',
      detalle: 'Ideal para directores de CEA: qué problemas resuelve, módulos principales y propuesta de valor.',
      src: 'videos/presentacion.mp4',
      poster: 'imagenes/video-presentacion.jpg',
    },
    {
      titulo: 'Recorrido: alumnos y matrículas',
      desc: 'Del registro al cobro.',
      detalle: 'Crea un alumno, matricula servicios, registra abonos y revisa cartera en tiempo real.',
      src: 'videos/modulos.mp4',
      poster: 'imagenes/video-modulos.jpg',
    },
    {
      titulo: 'Programación CEA en acción',
      desc: 'Calendario e instructores.',
      detalle: 'Planifica clases, asigna vehículos y muestra el portal del instructor.',
      src: 'videos/modulo-cea.mp4',
      poster: 'imagenes/video-cea.jpg',
    },
    {
      titulo: 'Caja y certificados',
      desc: 'Turno, recibo y emisión académica.',
      detalle: 'Abre caja, cobra, cierra turno y emite certificado con plantilla configurada.',
      src: 'videos/modulo-caja.mp4',
      poster: 'imagenes/video-caja.jpg',
    },
    {
      titulo: 'Facturación electrónica',
      desc: 'Emisión DIAN desde pagos.',
      detalle: 'Factura multi-ítem, PDF, nota crédito y hub de documentos fiscales.',
      src: 'videos/modulo-facturacion.mp4',
      poster: 'imagenes/video-facturacion.jpg',
    },
    {
      titulo: 'Testimonial / demo en vivo',
      desc: 'Tu video comercial o caso de éxito.',
      detalle: 'Espacio para entrevista con un CEA cliente o grabación de operación real.',
      src: 'videos/demo.mp4',
      poster: 'imagenes/video-demo.jpg',
    },
  ];
}
