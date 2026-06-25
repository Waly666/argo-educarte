import type { AsistenteContexto } from '../asistente.types';

/** Ayuda Mia — Cohortes académicas (diplomados, técnicos, grupos por semestre). */
export const ASISTENTE_COHORTES: Record<string, AsistenteContexto> = {
  'cohortes.hub': {
    id: 'cohortes.hub',
    modulo: 'cohortes',
    saludo: 'Centro de cohortes académicas: catálogo de materias, plan del programa, esquema de notas y grupos del año.',
    tips: [
      {
        id: 'coh-h-1',
        titulo: 'Cinco pasos en orden',
        cuerpo:
          '1) Catálogo de materias → 2) Plan del programa → 3) Esquema de notas (criterios y pesos) → 4) Grupos del año → 5) Banco de preguntas. Las cohortes heredan plan y esquema del programa.',
      },
      {
        id: 'coh-h-2',
        titulo: 'Catálogo de materias',
        cuerpo:
          'Defina cada tema una sola vez (ej. Legislación laboral). Todas las cohortes y programas que usen ese tema comparten el mismo banco de preguntas.',
      },
      {
        id: 'coh-h-3',
        titulo: 'Plan del programa',
        cuerpo:
          'Elija materias del catálogo y asigne las horas de cada semestre. La suma de horas de las materias debe coincidir exactamente con las horas del semestre (el medidor verde lo indica).',
      },
      {
        id: 'coh-h-3b',
        titulo: 'Esquema de notas',
        cuerpo:
          'Defina criterios (Participación, Talleres, Evaluaciones, etc.) que sumen 100%. Los criterios MANUAL los digita el instructor en cada grupo; EVALUACIONES se calculan de parciales/final; ASISTENCIA del promedio de notas en clases. Guarde el esquema antes de registrar notas.',
      },
      {
        id: 'coh-h-4',
        titulo: 'Grupos del año',
        cuerpo:
          'Un grupo = un semestre del programa en un periodo (año). Asigne instructor, cupo y modo de consumo de horas. Luego entre al grupo para programar clases e inscribir alumnos.',
      },
      {
        id: 'coh-h-5',
        titulo: 'Banco de preguntas',
        cuerpo:
          'Preguntas por materia del catálogo. Sirven para evaluaciones de cualquier cohorte que use esa materia. Use ✏️ para editar una pregunta existente.',
      },
      {
        id: 'coh-h-6',
        titulo: 'Programa con cohortes',
        cuerpo:
          'El programa debe tener activada la opción «Usa cohortes académicas» en Programas. Si no aparece en la lista, revíselo allí primero.',
      },
    ],
  },
  'cohortes.detalle': {
    id: 'cohortes.detalle',
    modulo: 'cohortes',
    saludo: 'Operación de un grupo: clases, asistencia, evaluaciones, materiales y certificado.',
    tips: [
      {
        id: 'coh-d-1',
        titulo: 'Pestañas del grupo',
        cuerpo:
          'Operación = clases y asistencia. Evaluaciones = cuestionarios (parcial/final). Notas manuales = participación, talleres, actitud. Materiales y Certificado = actas y elegibilidad.',
      },
      {
        id: 'coh-d-2',
        titulo: 'Programar clases',
        cuerpo:
          'Asistente automático: genera todas las sesiones según horas de cada materia. Manual: una clase puntual. Asigne instructor y enlace Meet si aplica.',
      },
      {
        id: 'coh-d-3',
        titulo: 'Tomar asistencia',
        cuerpo:
          'En cada clase pulse «Tomar asistencia». Marque presente/ausente y opcionalmente una nota. Las horas se consumen según el modo del grupo (al asistir o al dictar).',
      },
      {
        id: 'coh-d-4',
        titulo: 'Evaluaciones',
        cuerpo:
          'Cree evaluaciones en borrador, elija tipo Parcial o Final (según el esquema del programa), preguntas del banco o modo aleatorio, y publíquelas. Los alumnos las ven en el Aula Virtual.',
      },
      {
        id: 'coh-d-4b',
        titulo: 'Notas manuales',
        cuerpo:
          'En «Notas manuales» elija la materia y digite participación, talleres, actitud, etc. La nota final de la materia combina todos los criterios según el esquema del programa.',
      },
      {
        id: 'coh-d-5',
        titulo: 'Inscribir alumnos',
        cuerpo:
          'Ingrese el documento del alumno. Debe existir en el sistema. Un alumno se matricula a un semestre/cohorte a la vez.',
      },
      {
        id: 'coh-d-6',
        titulo: 'Portal del alumno',
        cuerpo:
          'En el Aula Virtual el alumno ve calendario de clases, materiales, evaluaciones y puede entrar al Meet marcando asistencia automática.',
      },
    ],
  },
};
