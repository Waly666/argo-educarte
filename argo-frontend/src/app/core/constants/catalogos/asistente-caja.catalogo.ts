import type { AsistenteContexto } from '../asistente.types';

export const ASISTENTE_CAJA: Record<string, AsistenteContexto> = {
  'caja.cuadre': {
    id: 'caja.cuadre',
    modulo: 'caja',
    saludo: 'Resumen del día — turno de caja del usuario.',
    tips: [
      {
        id: 'caj-ctx',
        titulo: 'Contexto de esta pantalla',
        cuerpo:
          'Su turno: cuadre, cobros e ingresos, y egresos. El administrador usa el cierre general aparte.',
      },
      {
        id: 'caj-1',
        titulo: 'Estado: caja abierta / cerrada',
        cuerpo:
          'Sin apertura no puede registrar movimientos. La alerta «Mi caja cerrada» en el encabezado parpadea hasta que abra turno.',
      },
      {
        id: 'caj-2',
        titulo: 'Abrir caja — saldo inicial',
        cuerpo:
          'Declare efectivo con el que inicia (base). Ese valor suma al cuadre esperado al cierre. Documente diferencias con supervisor.',
      },
      {
        id: 'caj-3',
        titulo: 'Totales del turno',
        cuerpo:
          'Ingresos y egresos del día en su sesión. No incluye otros cajeros; cada uno tiene sesión independiente.',
      },
      {
        id: 'caj-4',
        titulo: 'Saldo esperado en efectivo',
        cuerpo:
          'Calculado: inicial + ingresos efectivo − egresos efectivo. Debe coincidir con conteo físico al cerrar.',
      },
      {
        id: 'caj-5',
        titulo: 'Cerrar turno',
        cuerpo:
          'Ingresa conteo real. Si difiere, queda descuadre registrado para revisión admin. Tras cerrar no agrega movimientos a ese turno.',
      },
      {
        id: 'caj-6',
        titulo: 'Pestañas Ingresos / Egresos',
        cuerpo:
          'Detalle de movimientos de su sesión. Desde ahí crea ingresos de caja o egresos.',
      },
      {
        id: 'caj-7',
        titulo: 'Informe / impresión',
        cuerpo:
          'Puede generar resumen del turno para archivo físico según botones disponibles en pantalla.',
      },
    ],
  },
  'caja.ingreso-form': {
    id: 'caja.ingreso-form',
    modulo: 'caja',
    saludo: 'Formulario — ingreso de caja sin alumno.',
    tips: [
      {
        id: 'caj-if-ctx',
        titulo: 'Contexto de este formulario',
        cuerpo:
          'Contratos con terceros, aprovisionamiento de caja u otros ingresos que no van a liquidación de alumno.',
      },
      {
        id: 'caj-if-1',
        titulo: 'Caja abierta',
        cuerpo: 'Debe tener su turno abierto en Resumen del día para registrar el ingreso.',
      },
      {
        id: 'caj-if-2',
        titulo: 'Tipo de ingreso',
        cuerpo: 'Seleccione el concepto según catálogo. El valor suma al saldo de efectivo del turno.',
      },
    ],
  },
  'caja.egreso-form': {
    id: 'caja.egreso-form',
    modulo: 'caja',
    saludo: 'Formulario — egreso de caja.',
    tips: [
      {
        id: 'caj-ef-ctx',
        titulo: 'Contexto de este formulario',
        cuerpo:
          'Registra salida de efectivo de su turno: proveedor, devolución, gasto menor, etc. Adjunte soporte si la política del CEA lo exige.',
      },
    ],
  },
  'caja.ingresos': {
    id: 'caja.ingresos',
    modulo: 'caja',
    saludo: 'Ingresos registrados en su sesión de caja.',
    tips: [
      {
        id: 'caj-ing-1',
        titulo: 'Ingreso de alumno vs ingreso de caja',
        cuerpo:
          'Alumno: ligado a liquidación (desde Pagos o Cobros pendientes). Caja: concepto general sin alumno (otros ingresos).',
      },
      {
        id: 'caj-ing-2',
        titulo: 'Nuevo ingreso de caja',
        cuerpo:
          'Botón para registrar entrada de dinero no ligada a alumno. Aumenta saldo del turno.',
      },
      {
        id: 'caj-ing-3',
        titulo: 'Número de recibo',
        cuerpo:
          'Consecutivo según prefijo de sede (Configuración → Recibos). Único por ingreso.',
      },
      {
        id: 'caj-ing-4',
        titulo: 'Reimprimir recibo',
        cuerpo:
          'Desde la fila o detalle. Abre vista imprimible/PDF del comprobante.',
      },
      {
        id: 'caj-ing-5',
        titulo: 'Anular ingreso',
        cuerpo:
          'Revierte el abono y el efectivo del turno. Requiere permiso y motivo. Deja rastro en auditoría.',
      },
    ],
  },
  'caja.egresos': {
    id: 'caja.egresos',
    modulo: 'caja',
    saludo: 'Egresos (salidas de dinero) de su sesión.',
    tips: [
      {
        id: 'caj-egr-1',
        titulo: 'Propósito del egreso',
        cuerpo:
          'Registra salida de efectivo: proveedor, devolución alumno, gasto menor, etc. Reduce saldo del turno.',
      },
      {
        id: 'caj-egr-2',
        titulo: 'Nuevo egreso',
        cuerpo:
          'Complete concepto, valor, beneficiario. Adjunte soporte si la política del CEA lo exige.',
      },
      {
        id: 'caj-egr-3',
        titulo: 'Devolución vs nota crédito',
        cuerpo:
          'Devolver dinero al alumno = egreso en caja. Anular factura fiscal = nota crédito en Facturación (no sustituye egreso).',
      },
      {
        id: 'caj-egr-4',
        titulo: 'Comprobante de egreso',
        cuerpo:
          'Similar a ingreso: consecutivo e impresión. Guardar para contabilidad.',
      },
    ],
  },
  'caja.cobros-pendientes': {
    id: 'caja.cobros-pendientes',
    modulo: 'caja',
    saludo: 'Cola de cobros enviados a caja desde recepción.',
    tips: [
      {
        id: 'caj-cob-ctx',
        titulo: 'Contexto de esta pantalla',
        cuerpo:
          'Todos los servicios con saldo pendiente en el sistema (histórico completo). Abra un ítem para ver pagos y registrar el cobro.',
      },
      {
        id: 'caj-cob-1',
        titulo: 'Origen del ítem',
        cuerpo:
          'Recepción «envía a caja» liquidaciones con saldo. El cajero cobra sin buscar alumno manualmente.',
      },
      {
        id: 'caj-cob-2',
        titulo: 'Registrar cobro',
        cuerpo:
          'Seleccione fila → confirme valor → crea ingreso en su caja abierta y reduce saldo del alumno.',
      },
      {
        id: 'caj-cob-3',
        titulo: 'Caja cerrada',
        cuerpo:
          'Si intenta cobrar sin turno abierto, ARGO bloquea y muestra aviso. Abra caja en Resumen del día.',
      },
      {
        id: 'caj-cob-4',
        titulo: 'Priorización',
        cuerpo:
          'Atienda primero ítems urgentes (examen hoy, trámite RUNT). La lista no ordena por prioridad automática.',
      },
    ],
  },
  'caja.cierres': {
    id: 'caja.cierres',
    modulo: 'caja',
    saludo: 'Administración — historial de cierres de turno.',
    tips: [
      {
        id: 'caj-cie-1',
        titulo: 'Quién ve esto',
        cuerpo:
          'Permiso caja.admin. Lista todos los cierres de cajeros por sede/período.',
      },
      {
        id: 'caj-cie-2',
        titulo: 'Detalle de cierre',
        cuerpo:
          'Entre a un cierre para ver movimientos, descuadre, usuario y hora. Auditoría de turnos.',
      },
      {
        id: 'caj-cie-3',
        titulo: 'Descuadre',
        cuerpo:
          'Diferencia entre conteo declarado y saldo esperado. Investigue antes de ajustes contables.',
      },
    ],
  },
  'caja.cierre-general': {
    id: 'caja.cierre-general',
    modulo: 'caja',
    saludo: 'Cierre general consolidado de la sede.',
    tips: [
      {
        id: 'caj-cg-1',
        titulo: 'Diferencia con cierre de turno',
        cuerpo:
          'Cada cajero cierra su turno. Cierre general consolida el día/sede para contabilidad o gerencia.',
      },
      {
        id: 'caj-cg-2',
        titulo: 'Cuándo ejecutarlo',
        cuerpo:
          'Al final del día operativo cuando todos los turnos relevantes estén cerrados.',
      },
    ],
  },
  'caja.ingresos-todos': {
    id: 'caja.ingresos-todos',
    modulo: 'caja',
    saludo: 'Consulta global de ingresos (administración).',
    tips: [
      {
        id: 'caj-it-1',
        titulo: 'Alcance',
        cuerpo:
          'Todos los ingresos de todas las sesiones/cajeros. Filtre por fecha, sede o usuario.',
      },
      {
        id: 'caj-it-2',
        titulo: 'Cruce con alumno',
        cuerpo:
          'Identifique numDoc o liquidación en detalle para soporte a reclamos.',
      },
    ],
  },
  'caja.egresos-todos': {
    id: 'caja.egresos-todos',
    modulo: 'caja',
    saludo: 'Consulta global de egresos (administración).',
    tips: [
      {
        id: 'caj-et-1',
        titulo: 'Auditoría de salidas',
        cuerpo:
          'Revise egresos por período. Detecte patrones o montos atípicos.',
      },
    ],
  },
  'caja.descuadres': {
    id: 'caja.descuadres',
    modulo: 'caja',
    saludo: 'Descuadres de caja registrados.',
    tips: [
      {
        id: 'caj-d-1',
        titulo: 'Qué es un descuadre',
        cuerpo:
          'Al cerrar turno, conteo físico ≠ saldo esperado. ARGO guarda diferencia y responsable.',
      },
      {
        id: 'caj-d-2',
        titulo: 'Seguimiento',
        cuerpo:
          'Supervisor documenta causa (error cambio, falta soporte, etc.) fuera del sistema si aplica.',
      },
    ],
  },
};
