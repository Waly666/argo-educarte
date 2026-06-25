import type { AsistenteContexto } from '../asistente.types';

export const ASISTENTE_CORE: Record<string, AsistenteContexto> = {
  'inicio.home': {
    id: 'inicio.home',
    modulo: 'inicio',
    saludo: 'Pantalla de inicio de ARGO.',
    tips: [
      {
        id: 'ini-1',
        titulo: 'Menú lateral',
        cuerpo:
          'Acceso a módulos según su rol. Grupos colapsables (Configuración, Caja admin…). Si no ve un ítem, no tiene permiso.',
      },
      {
        id: 'ini-2',
        titulo: 'Alertas del encabezado',
        cuerpo:
          'Franjas parpadeantes = acción urgente: abrir caja, certificado por vencer, documento vehículo, clase CEA, etc. Clic lleva al módulo correspondiente.',
      },
      {
        id: 'ini-3',
        titulo: 'Mia — asistente de ayuda',
        cuerpo:
          'Icono abajo a la derecha. Explica la lógica de la pantalla actual. Use ‹ › para recorrer todos los tips. Silenciar u ocultar desde el panel.',
      },
      {
        id: 'ini-4',
        titulo: 'Sede activa',
        cuerpo:
          'Si opera multi-sede, verifique sede seleccionada en barra superior. Reportes y consecutivos dependen de ella.',
      },
      {
        id: 'ini-5',
        titulo: 'Usuario y cerrar sesión',
        cuerpo:
          'Menú usuario arriba: perfil y salida. Cierre sesión al terminar turno en equipos compartidos.',
      },
      {
        id: 'ini-6',
        titulo: 'Flujo típico alumno nuevo',
        cuerpo:
          '1) Crear alumno → 2) Matricular servicios → 3) Registrar pagos → 4) Documentos → 5) Programación CEA → 6) Certificado / factura si aplica.',
      },
      {
        id: 'ini-7',
        titulo: 'Cohortes académicas',
        cuerpo:
          'Para diplomados y técnicos por semestre: menú Cohortes académicas. Catálogo de materias → plan del programa → grupos del año.',
      },
      {
        id: 'ini-8',
        titulo: 'Aula virtual',
        cuerpo:
          'Menú Aula virtual: admin del portal y editor del sitio público. Los alumnos de cohortes ven clases y evaluaciones allí.',
      },
    ],
  },
  'dashboard.main': {
    id: 'dashboard.main',
    modulo: 'dashboard',
    saludo: 'Dashboard — indicadores del CEA.',
    tips: [
      {
        id: 'dash-1',
        titulo: 'KPIs',
        cuerpo:
          'Totales calculados en tiempo real desde base de datos: alumnos, matrículas, cobros, etc.',
      },
      {
        id: 'dash-2',
        titulo: 'Interpretación',
        cuerpo:
          'Variaciones día a día reflejan operación real. No sustituye reportes contables formales.',
      },
      {
        id: 'dash-3',
        titulo: 'Profundizar',
        cuerpo:
          'Use módulos específicos (Alumnos, Caja, Certificados) para detalle transaccional.',
      },
    ],
  },
  'general.sin-acceso': {
    id: 'general.sin-acceso',
    modulo: 'general',
    saludo: 'Pantalla sin permiso.',
    tips: [
      {
        id: 'sa-1',
        titulo: 'Causa',
        cuerpo:
          'Su rol no incluye el permiso requerido para esta URL. ARGO bloquea por seguridad, no es error de datos.',
      },
      {
        id: 'sa-2',
        titulo: 'Solución',
        cuerpo:
          'Vuelva al inicio o pida al administrador el permiso en Configuración → Roles (ej. caja.admin, alumnos.gestionar).',
      },
    ],
  },
};
