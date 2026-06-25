import { ConfigRecibo } from './config.service';
import {
  CajaDescuadre,
  CajaEgresoItem,
  CajaIngresoItem,
  CajaSesion,
  ResumenCaja,
  ResumenCierreGeneral,
  ResumenTipoMovimiento,
  ResumenServicioIngreso,
} from './caja-sesion.service';
import { ArqueoLinea } from '../constants/caja-arqueo.constants';
import { resolverFormaPagoIngreso } from '../utils/caja-forma-pago.util';

const DOC_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #fff !important;
    color: #1a1a1a !important;
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc { max-width: 100%; margin: 0 auto; }
  .doc-header {
    display: flex; gap: 14px; align-items: flex-start;
    border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 12px;
  }
  .doc-logo-img {
    max-height: 72px; max-width: 180px; object-fit: contain; flex-shrink: 0; display: block;
  }
  .doc-logo-placeholder {
    width: 56px; height: 56px; border: 2px solid #1e3a5f; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 13px; color: #1e3a5f; flex-shrink: 0;
  }
  .doc-empresa h1 {
    margin: 0 0 4px; font-size: 17pt; font-weight: 700; color: #1e3a5f;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .doc-empresa .doc-sede {
    margin: 0 0 6px; font-size: 12pt; font-weight: 600; color: #2d4a6f;
  }
  .doc-empresa p { margin: 0; font-size: 9pt; color: #333; }
  .doc-titulo-block {
    text-align: center; margin: 14px 0 16px;
    border-top: 1px solid #ccc; border-bottom: 1px solid #ccc;
    padding: 10px 0; background: #f8f9fb;
  }
  .doc-titulo-block h2 {
    margin: 0; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px;
    color: #1e3a5f; font-weight: 700;
  }
  .doc-titulo-block p { margin: 4px 0 0; font-size: 9pt; color: #444; }
  .doc-meta {
    width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.5pt;
  }
  .doc-meta td { padding: 3px 0; vertical-align: top; }
  .doc-meta td:first-child { width: 130px; font-weight: 600; color: #555; }
  .barra-inicial { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #999; margin-bottom: 10px; text-align: center; font-size: 9pt; }
  .barra-inicial.barra-4 { grid-template-columns: repeat(4, 1fr); }
  .tbl-saldo-efectivo { margin-bottom: 14px; }
  tr.fila-efectivo td { background: #e8f5e9 !important; }
  .nota-forma-pago { font-size: 8.5pt; color: #555; margin: 0 0 8px; }
  .barra-inicial div { padding: 6px; border-right: 1px solid #999; background: #edf2f7; }
  .barra-inicial div:last-child { border-right: none; }
  .barra-inicial strong { display: block; font-size: 8pt; text-transform: uppercase; color: #555; }
  .hdr-entrada { background: #1a365d !important; color: #fff !important; font-weight: 700; padding: 6px 10px; margin-top: 8px; }
  .hdr-resumen-serv { background: #1e3a5f !important; color: #fff !important; font-weight: 700; padding: 6px 10px; margin-top: 10px; }
  .tbl.resumen-serv tbody tr:nth-child(even) { background: #f8fafc; }
  .hdr-salida { background: #b8860b !important; color: #111 !important; font-weight: 700; padding: 6px 10px; margin-top: 8px; }
  .hdr-arqueo { background: #2d6a4f !important; color: #fff !important; font-weight: 700; padding: 6px 10px; margin-top: 8px; }
  table.tbl.salidas tr.total td { background: #b8860b !important; color: #111 !important; }
  table.tbl tbody tr:nth-child(even) td { background: #f8fafc; }
  table.tbl tr.total td { background: #1a365d !important; color: #fff !important; font-weight: 700; }
  .sec-detalle { margin-top: 12px; font-weight: 700; text-transform: uppercase; color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 2px; }
  .sec {
    margin: 16px 0 6px; font-size: 9.5pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: #1e3a5f; border-bottom: 1px solid #bbb; padding-bottom: 3px;
  }
  table.tbl {
    width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5pt;
  }
  table.tbl th, table.tbl td {
    border: 1px solid #999; padding: 5px 8px; vertical-align: top;
  }
  table.tbl th {
    background: #e8edf2; font-weight: 700; text-align: left; color: #1a1a1a;
  }
  table.tbl td.num, table.tbl th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  table.tbl tr.total td {
    background: #f0f4f8; font-weight: 700; border-top: 2px solid #1e3a5f;
  }
  table.tbl tr.warn td { background: #fff5f5; color: #8b0000; }
  table.tbl.compact th, table.tbl.compact td { padding: 4px 6px; font-size: 9pt; }
  table.tbl.detalle { font-size: 8.5pt; }
  table.tbl.detalle th, table.tbl.detalle td { padding: 3px 5px; }
  table.tbl tfoot td { font-weight: 700; background: #f0f4f8; }
  .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .alerta {
    border: 1px solid #c9a000; background: #fffbea; padding: 8px 10px;
    margin: 10px 0 14px; font-size: 9pt; border-radius: 2px;
  }
  .alerta strong { color: #7a5d00; display: block; margin-bottom: 4px; }
  .doc-footer {
    margin-top: 24px; padding-top: 12px; border-top: 1px solid #ccc;
    font-size: 8.5pt; color: #666; text-align: center;
  }
  .firmas {
    display: grid; grid-template-columns: 1fr 1fr; gap: 40px;
    margin-top: 32px; font-size: 9pt; text-align: center;
  }
  .firmas .linea {
    border-top: 1px solid #333; margin-bottom: 6px; padding-top: 4px;
  }
  .toolbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 99;
    background: #1e3a5f; color: #fff; padding: 10px 16px;
    display: flex; gap: 10px; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,.2);
  }
  .toolbar button {
    background: #fff; color: #1e3a5f; border: none; padding: 8px 16px;
    border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 10pt;
  }
  .toolbar span { font-size: 10pt; opacity: .9; }
  @media print {
    .toolbar { display: none !important; }
    body { padding: 0 !important; }
  }
  @media screen {
    body { padding: 56px 16px 24px; background: #e5e7eb !important; }
    .doc {
      background: #fff; padding: 16mm 14mm;
      box-shadow: 0 4px 24px rgba(0,0,0,.15);
    }
  }
`;

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtFecha(d: unknown, conHora = false): string {
  if (!d) return '—';
  const dt = new Date(String(d));
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function fmtEstadoDescuadre(estado?: string | null): string {
  if (estado === 'pendiente') return 'Pendiente';
  if (estado === 'resuelto') return 'Resuelto';
  if (estado === 'en_nomina') return 'En nómina';
  if (estado === 'descontado_nomina') return 'Descontado en nómina';
  return estado || '—';
}

function egresosPorForma(res: ResumenCaja): ResumenTipoMovimiento[] {
  const rows = res.egresosPorFormaPago ?? [];
  if (rows.length) return rows;
  return (res.egresosPorTipo ?? []).map((r) => ({
    ...r,
    descripcion: r.descripcion || r.tipoEgreso || 'Egreso',
  }));
}

function sedeDocumentoLabel(empresa: ConfigRecibo | null | undefined, idSede?: string | null): string {
  const nombre = String(empresa?.nombreSede || '').trim();
  if (nombre) return nombre;
  const sid = String(idSede || '').trim();
  return sid || '';
}

function filaMetaSede(empresa: ConfigRecibo | null | undefined, idSede?: string | null): string {
  const label = sedeDocumentoLabel(empresa, idSede);
  if (!label) return '';
  return `<tr><td>Sede</td><td colspan="3"><strong>${esc(label)}</strong></td></tr>`;
}

export function encabezadoEmpresa(empresa: ConfigRecibo | null | undefined, idSede?: string | null): string {
  const institucion = esc(empresa?.nombreEmpresa || 'ARGO');
  const sede = esc(sedeDocumentoLabel(empresa, idSede));
  const ciudadLine = [empresa?.ciudad, empresa?.departamento]
    .filter((x) => String(x || '').trim())
    .map((x) => esc(String(x)))
    .join(', ');
  const lineas = [
    empresa?.nit ? `NIT: ${esc(empresa.nit)}` : '',
    empresa?.telefono ? `Tel: ${esc(empresa.telefono)}` : '',
    empresa?.direccion ? `Dir: ${esc(empresa.direccion)}` : '',
    ciudadLine ? ciudadLine : '',
    empresa?.email ? `Email: ${esc(empresa.email)}` : '',
  ]
    .filter(Boolean)
    .map((l) => `<p>${l}</p>`)
    .join('');

  const logoHtml = empresa?.urlLogoDataUrl
    ? `<img class="doc-logo-img" src="${esc(empresa.urlLogoDataUrl)}" alt="${institucion}" />`
    : `<div class="doc-logo-placeholder">ARGO</div>`;

  return `
    <header class="doc-header">
      ${logoHtml}
      <div class="doc-empresa">
        <h1>${institucion}</h1>
        ${sede ? `<h2 class="doc-sede">${sede}</h2>` : ''}
        ${lineas}
      </div>
    </header>`;
}

function esFormaEfectivo(forma: unknown): boolean {
  const s = String(forma ?? '')
    .trim()
    .toLowerCase();
  return s.includes('efect') || s === 'ef' || s === 'efectivo' || s === 'cash';
}

function ingresosElectronicosSesion(s: ResumenCaja): number {
  if (s.totalIngresosElectronicos != null) return Number(s.totalIngresosElectronicos) || 0;
  const total = Number(s.totalIngresos) || 0;
  const efectivo = Number(s.totalIngresosEfectivo) || 0;
  return Math.max(0, total - efectivo);
}

function normFormaKey(forma: unknown): string {
  const s = String(forma ?? '').trim();
  return s || 'Sin especificar';
}

interface FilaSaldoForma {
  forma: string;
  ingresos: number;
  egresos: number;
  saldo: number;
  esEfectivo: boolean;
}

function filasSaldoPorFormaPago(g: ResumenCierreGeneral): FilaSaldoForma[] {
  const map = new Map<string, FilaSaldoForma>();

  const touch = (forma: string) => {
    const key = normFormaKey(forma);
    if (!map.has(key)) {
      map.set(key, {
        forma: key,
        ingresos: 0,
        egresos: 0,
        saldo: 0,
        esEfectivo: esFormaEfectivo(key),
      });
    }
    return map.get(key)!;
  };

  if ((g.ingresosDetalle?.length ?? 0) > 0 || (g.egresosDetalle?.length ?? 0) > 0) {
    for (const i of g.ingresosDetalle ?? []) {
      const row = touch(resolverFormaPagoIngreso(i));
      row.ingresos += Number(i.valor) || 0;
      row.saldo = row.ingresos - row.egresos;
    }
    for (const e of g.egresosDetalle ?? []) {
      const row = touch(e.formaPago || 'Efectivo');
      row.egresos += Number(e.valorEgreso) || 0;
      row.saldo = row.ingresos - row.egresos;
    }
  } else {
    for (const t of g.ingresosPorTipo ?? []) {
      const row = touch(t.descripcion || String(t.idTipoPago ?? 'Ingreso'));
      row.ingresos += Number(t.total) || 0;
      row.saldo = row.ingresos - row.egresos;
    }
    for (const t of g.egresosPorFormaPago ?? []) {
      const row = touch(t.descripcion || t.formaPago || 'Egreso');
      row.egresos += Number(t.total) || 0;
      row.saldo = row.ingresos - row.egresos;
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.esEfectivo !== b.esEfectivo) return a.esEfectivo ? -1 : 1;
    return Math.abs(b.saldo) - Math.abs(a.saldo);
  });
}

function totalesEfectivoCaja(g: ResumenCierreGeneral, filas: FilaSaldoForma[]) {
  const efe = filas.find((f) => f.esEfectivo);
  const ingresosEfectivo = efe?.ingresos ?? 0;
  const egresosEfectivo = efe?.egresos ?? 0;
  const saldoInicial = Number(g.saldoInicialTotal) || 0;
  const saldoMovEfectivo = ingresosEfectivo - egresosEfectivo;
  const esperado =
    Number(g.totalEfectivoEsperado) || saldoInicial + saldoMovEfectivo;
  return {
    ingresosEfectivo,
    egresosEfectivo,
    saldoMovEfectivo,
    saldoEfectivoEsperado: esperado,
    saldoEfectivoContado: g.totalEfectivoContado,
    diferencia: g.totalDiferencia,
  };
}

function htmlSaldoCaja(g: ResumenCierreGeneral, filas: FilaSaldoForma[]): string {
  const t = totalesEfectivoCaja(g, filas);
  return `
    <div class="sec">Saldo de caja (efectivo)</div>
    <p class="nota-forma-pago">Efectivo en caja = base inicial + ingresos en efectivo − egresos en efectivo.</p>
    <div class="barra-inicial barra-4">
      <div><strong>Base inicial</strong>${money(g.saldoInicialTotal)}</div>
      <div><strong>(+) Ingresos efectivo</strong>${money(t.ingresosEfectivo)}</div>
      <div><strong>(−) Egresos efectivo</strong>${money(t.egresosEfectivo)}</div>
      <div><strong>= Saldo mov. efectivo</strong>${money(t.saldoMovEfectivo)}</div>
    </div>
    <table class="tbl tbl-saldo-efectivo">
      <tbody>
        <tr class="total">
          <td><strong>Saldo efectivo esperado en caja</strong> (base + ingresos efectivo − egresos efectivo)</td>
          <td class="num"><strong>${money(t.saldoEfectivoEsperado)}</strong></td>
        </tr>
        <tr>
          <td>Efectivo contado (suma de arqueos de cajeros)</td>
          <td class="num">${money(t.saldoEfectivoContado)}</td>
        </tr>
        <tr class="${g.cantidadDescuadres ? 'warn' : ''}">
          <td><strong>Diferencia (contado − esperado)</strong></td>
          <td class="num"><strong>${money(t.diferencia)}</strong></td>
        </tr>
      </tbody>
    </table>`;
}

function htmlSaldoPorFormaPago(filas: FilaSaldoForma[]): string {
  if (!filas.length) return '';
  const totalIng = filas.reduce((a, r) => a + r.ingresos, 0);
  const totalEg = filas.reduce((a, r) => a + r.egresos, 0);
  const body = filas
    .map(
      (r) => `<tr class="${r.esEfectivo ? 'fila-efectivo' : ''}">
        <td>${esc(r.forma)}${r.esEfectivo ? ' <strong>(caja)</strong>' : ''}</td>
        <td class="num">${money(r.ingresos)}</td>
        <td class="num">${money(r.egresos)}</td>
        <td class="num"><strong>${money(r.saldo)}</strong></td>
      </tr>`,
    )
    .join('');
  return `
    <div class="sec">Saldo por forma de pago</div>
    <p class="nota-forma-pago">En cada medio: ingresos menos egresos. La fila <strong>Efectivo</strong> es el dinero que debe quedar en caja.</p>
    <table class="tbl">
      <thead>
        <tr><th>Forma de pago</th><th class="num">Ingresos</th><th class="num">Egresos</th><th class="num">Saldo</th></tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr class="total">
          <td><strong>TOTAL</strong></td>
          <td class="num"><strong>${money(totalIng)}</strong></td>
          <td class="num"><strong>${money(totalEg)}</strong></td>
          <td class="num"><strong>${money(totalIng - totalEg)}</strong></td>
        </tr>
      </tfoot>
    </table>`;
}

function tablaTipos(titulo: string, rows: ResumenTipoMovimiento[], labelKey: 'descripcion' | 'formaPago' = 'descripcion'): string {
  if (!rows?.length) return '';
  const body = rows
    .map(
      (t) => `<tr>
        <td>${esc(t.descripcion || t[labelKey] || t.idTipoPago || t.tipoEgreso)}</td>
        <td class="num">${t.cantidad ?? 0}</td>
        <td class="num">${money(t.total)}</td>
      </tr>`,
    )
    .join('');
  return `
    <div>
      <div class="sec">${esc(titulo)}</div>
      <table class="tbl compact">
        <thead><tr><th>Forma de pago</th><th class="num">Cant.</th><th class="num">Total</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function pieDocumento(empresa: ConfigRecibo | null | undefined): string {
  const msg = esc(empresa?.mensajePie || 'Documento generado por ARGO — Sistema de Información');
  return `
    <div class="firmas">
      <div><div class="linea">Elaborado por</div></div>
      <div><div class="linea">Revisado / Aprobado</div></div>
    </div>
    <footer class="doc-footer"><p>${msg}</p></footer>`;
}

function wrapDocumento(
  titulo: string,
  cuerpo: string,
  empresa?: ConfigRecibo | null,
  idSede?: string | null,
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(titulo)}</title>
  <style>${DOC_CSS}</style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
    <button type="button" onclick="window.close()">Cerrar</button>
    <span>${esc(titulo)}</span>
  </div>
  <div class="doc">
    ${encabezadoEmpresa(empresa, idSede)}
    ${cuerpo}
    ${pieDocumento(empresa)}
  </div>
</body>
</html>`;
}

function tablaArqueoHtml(arqueo: ArqueoLinea[] | undefined, total: number | undefined): string {
  const lineas = (arqueo ?? []).filter((l) => (l.cantidad ?? 0) > 0);
  if (!lineas.length && !total) return '';
  const rows = lineas
    .map(
      (l) => `<tr>
        <td>${esc(l.etiqueta || money(l.denominacion))}</td>
        <td class="num">${l.cantidad ?? 0}</td>
        <td class="num">${money(l.subtotal ?? (l.denominacion ?? 0) * (l.cantidad ?? 0))}</td>
      </tr>`,
    )
    .join('');
  return `
    <div class="hdr-arqueo">ARQUEO DE EFECTIVO — CONTEO FÍSICO</div>
    <table class="tbl">
      <thead><tr><th>Denominación</th><th class="num">Cantidad</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">Sin conteo registrado</td></tr>'}</tbody>
      <tr class="total"><td colspan="2"><strong>TOTAL EFECTIVO EN CAJA (ARQUEO)</strong></td><td class="num"><strong>${money(total)}</strong></td></tr>
    </table>`;
}

/** Agrupa filas por nombre de servicio (suma totales, ignora sesión). */
export function agruparTotalesPorServicio(
  filas: { servicio?: string; descripcion?: string; total?: number }[],
): { servicio: string; total: number }[] {
  const map = new Map<string, number>();
  for (const s of filas) {
    const key = String(s.servicio || s.descripcion || 'Ingreso').trim() || 'Ingreso';
    map.set(key, (map.get(key) || 0) + (Number(s.total) || 0));
  }
  return [...map.entries()]
    .map(([servicio, total]) => ({ servicio, total }))
    .sort((a, b) => b.total - a.total);
}

/** Tabla compacta: solo servicio y total (cierre general consolidado). */
export function htmlResumenPorServiciosCompacto(
  filas: { servicio?: string; descripcion?: string; total?: number }[],
): string {
  const ordenados = agruparTotalesPorServicio(filas);
  if (!ordenados.length) return '';
  const totalGen = ordenados.reduce((a, s) => a + s.total, 0);
  const body = ordenados
    .map(
      (s) => `<tr>
        <td>${esc(s.servicio)}</td>
        <td class="num"><strong>${money(s.total)}</strong></td>
      </tr>`,
    )
    .join('');
  return `
    <div class="hdr-resumen-serv">RESUMEN POR SERVICIOS</div>
    <table class="tbl resumen-serv">
      <thead><tr><th>Servicio</th><th class="num">Total</th></tr></thead>
      <tbody>${body}</tbody>
      <tr class="total"><td><strong>TOTAL</strong></td><td class="num"><strong>${money(totalGen)}</strong></td></tr>
    </table>`;
}

export function htmlResumenPorServicios(servicios: ResumenServicioIngreso[]): string {
  if (!servicios.length) return '';
  const ordenados = [...servicios].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const totalCant = ordenados.reduce((a, s) => a + (s.cantidad ?? 0), 0);
  const totalEfe = ordenados.reduce((a, s) => a + (s.efectivo ?? 0), 0);
  const totalOtr = ordenados.reduce((a, s) => a + (s.otros ?? 0), 0);
  const totalGen = ordenados.reduce((a, s) => a + (s.total ?? 0), 0);

  const filas = ordenados
    .map(
      (s, idx) => `<tr>
        <td class="num">${idx + 1}</td>
        <td>${esc(s.descripcion || s.servicio)}</td>
        <td class="num">${s.cantidad ?? 0}</td>
        <td class="num">${money(s.efectivo)}</td>
        <td class="num">${money(s.otros)}</td>
        <td class="num"><strong>${money(s.total)}</strong></td>
      </tr>`,
    )
    .join('');

  return `
    <div class="hdr-resumen-serv">RESUMEN POR SERVICIOS</div>
    <table class="tbl resumen-serv">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Servicio</th>
          <th class="num">Recibos</th>
          <th class="num">Efectivo</th>
          <th class="num">Otros medios</th>
          <th class="num">Total servicio</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
      <tr class="total">
        <td colspan="2"><strong>TOTAL GENERAL</strong></td>
        <td class="num"><strong>${totalCant}</strong></td>
        <td class="num"><strong>${money(totalEfe)}</strong></td>
        <td class="num"><strong>${money(totalOtr)}</strong></td>
        <td class="num"><strong>${money(totalGen)}</strong></td>
      </tr>
    </table>`;
}

function servicioIngresoLabel(i: CajaIngresoItem): string {
  if (i.esIngresoCaja) {
    return i.tipoIngresoDescr || i.tipoIngreso || i.concepto || 'Ingreso caja';
  }
  return (
    i.liquidacionDescr ||
    i.tipoAbonoDescr ||
    i.tipoIngresoDescr ||
    i.concepto ||
    'Ingreso'
  );
}

export function buildInformeIndividualHtml(opts: {
  sesion: CajaSesion;
  resumen: ResumenCaja;
  ingresos: CajaIngresoItem[];
  egresos: CajaEgresoItem[];
  descuadre?: CajaDescuadre | null;
  empresa?: ConfigRecibo | null;
}): string {
  const { sesion, resumen: r, ingresos, egresos, descuadre, empresa } = opts;
  const nombreCajero = r.nombreCajero || sesion.usuario || '—';
  const fechaCierre = sesion.fechaCierre || r.fechaCierre;
  const hayDescuadre =
    descuadre || (r.diferencia != null && Math.abs(r.diferencia) >= 1);

  const servicios: ResumenServicioIngreso[] =
    r.ingresosPorServicio?.length
      ? r.ingresosPorServicio
      : agruparServiciosDesdeIngresos(ingresos);

  const resumenServiciosHtml = htmlResumenPorServicios(servicios);

  const egresosTipo = r.egresosPorTipo ?? [];
  const filasSalida = egresosTipo
    .map(
      (t) => `<tr>
        <td>${fmtFecha(fechaCierre)}</td>
        <td>${esc(t.descripcion || t.tipoEgreso)}</td>
        <td class="num">${money(t.total)}</td>
      </tr>`,
    )
    .join('');
  const totalSalida = egresosTipo.reduce((a, t) => a + (t.total ?? 0), 0);

  const ingDet = ingresos
    .map(
      (i) => `<tr>
        <td>${esc(i.numRecibo)}</td>
        <td>${fmtFecha(i.fecha)}</td>
        <td>${esc(servicioIngresoLabel(i))}</td>
        <td>${esc(resolverFormaPagoIngreso(i))}</td>
        <td>${esc(i.pagadorDescr || i.recibidoDe || '—')}</td>
        <td class="num">${money(i.valor)}</td>
      </tr>`,
    )
    .join('');

  const egDet = egresos
    .map(
      (e) => `<tr>
        <td>${esc(e.numRecibo || e.idEgreso)}</td>
        <td>${fmtFecha(e.fechaEgreso)}</td>
        <td>${esc(e.concepto)}</td>
        <td>${esc(e.tipoEgresoDescr || '—')}</td>
        <td>${esc(e.formaPago || 'Efectivo')}</td>
        <td class="num">${money(e.valorEgreso)}</td>
      </tr>`,
    )
    .join('');

  const alertaDesc = hayDescuadre
    ? `<div class="alerta"><strong>NOVEDAD DE DESCUADRE</strong>
        Estado: ${fmtEstadoDescuadre(descuadre?.estado || sesion.descuadreEstado)} —
        Diferencia: ${money(descuadre?.diferencia ?? r.diferencia)}
        ${(descuadre?.montoDebe ?? 0) > 0 ? ` · Faltante: ${money(descuadre?.montoDebe)}` : ''}
      </div>`
    : '';

  const cuerpo = `
    <div class="doc-titulo-block">
      <h2>Cuadre de caja — Informe contable</h2>
      <p>Sesión #${sesion.idSesion} · ${fmtFecha(fechaCierre, true)}</p>
    </div>
    <table class="doc-meta">
      ${filaMetaSede(empresa, sesion.idSede)}
      <tr><td>Cajero</td><td colspan="3"><strong>${esc(nombreCajero)}</strong></td></tr>
      <tr><td>Sesión</td><td>#${sesion.idSesion}</td><td>Apertura</td><td>${fmtFecha(sesion.fechaApertura, true)}</td></tr>
      <tr><td>Impreso</td><td>${fmtFecha(new Date().toISOString(), true)}</td><td>Cierre</td><td>${fmtFecha(fechaCierre, true)}</td></tr>
    </table>
    <div class="barra-inicial">
      <div><strong>Base inicial</strong>${money(r.saldoInicial)}</div>
      <div><strong>Efectivo esperado</strong>${money(r.efectivoEsperado)}</div>
      <div><strong>Efectivo contado (arqueo)</strong>${money(r.arqueoTotal ?? r.efectivoContado)}</div>
    </div>
    ${tablaArqueoHtml(r.arqueo, r.arqueoTotal ?? r.efectivoContado)}
    ${resumenServiciosHtml || '<div class="hdr-resumen-serv">RESUMEN POR SERVICIOS</div><p>Sin ingresos por servicio.</p>'}
    <div class="hdr-salida">(−) PAGOS DE SALIDA</div>
    <table class="tbl salidas">
      <thead><tr><th>Fecha</th><th>Concepto / tipo egreso</th><th class="num">Valor</th></tr></thead>
      <tbody>${filasSalida || '<tr><td colspan="3">Sin egresos</td></tr>'}</tbody>
      <tr class="total"><td colspan="2"><strong>TOTAL SALIDAS</strong></td><td class="num"><strong>${money(totalSalida)}</strong></td></tr>
    </table>
    <table class="tbl" style="margin-top:10px">
      <tr class="${hayDescuadre ? 'warn' : 'total'}"><td colspan="4"><strong>CUADRE — DIFERENCIA (Contado − Esperado)</strong></td><td class="num"><strong>${money(r.diferencia)}</strong></td></tr>
    </table>
    ${alertaDesc}
    <div class="sec-detalle">Detalle de ingresos (${ingresos.length})</div>
    <table class="tbl detalle">
      <thead><tr><th>Recibo</th><th>Fecha</th><th>Servicio</th><th>Pago</th><th>Recibido de</th><th class="num">Valor</th></tr></thead>
      <tbody>${ingDet || '<tr><td colspan="6">—</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5"><strong>Total ingresos</strong></td><td class="num"><strong>${money(r.totalIngresos)}</strong></td></tr></tfoot>
    </table>
    <div class="sec-detalle">Detalle de egresos (${egresos.length})</div>
    <table class="tbl detalle">
      <thead><tr><th>Recibo</th><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Forma pago</th><th class="num">Valor</th></tr></thead>
      <tbody>${egDet || '<tr><td colspan="6">—</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5"><strong>Total egresos</strong></td><td class="num"><strong>${money(r.totalEgresos)}</strong></td></tr></tfoot>
    </table>`;

  return wrapDocumento(`Cuadre de caja #${sesion.idSesion}`, cuerpo, empresa, sesion.idSede);
}

function agruparServiciosDesdeIngresos(ingresos: CajaIngresoItem[]): ResumenServicioIngreso[] {
  const map = new Map<string, ResumenServicioIngreso>();
  for (const i of ingresos) {
    const key = servicioIngresoLabel(i);
    const prev = map.get(key) || {
      servicio: key,
      descripcion: key,
      cantidad: 0,
      total: 0,
      efectivo: 0,
      otros: 0,
    };
    const v = Number(i.valor) || 0;
    const fp = resolverFormaPagoIngreso(i).toLowerCase();
    const esEfe = fp.includes('efect') || fp === 'ef' || i.idTipoPago === '1';
    prev.cantidad += 1;
    prev.total += v;
    if (esEfe) prev.efectivo = (prev.efectivo ?? 0) + v;
    else prev.otros = (prev.otros ?? 0) + v;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function buildInformeGeneralHtml(opts: {
  general: ResumenCierreGeneral;
  empresa?: ConfigRecibo | null;
}): string {
  const g = opts.general;
  const empresa = opts.empresa;

  const filas = [
    ['Base inicial total', money(g.saldoInicialTotal)],
    ['Total ingresos', money(g.totalIngresos)],
    ['Total egresos', money(g.totalEgresos)],
    ['Saldo teórico consolidado', money(g.saldoTeoricoConsolidado)],
    ['Efectivo esperado total', money(g.totalEfectivoEsperado)],
    ['Efectivo contado total', money(g.totalEfectivoContado)],
    ['Diferencia total', money(g.totalDiferencia)],
  ]
    .map(
      ([c, v], i) =>
        `<tr class="${i >= 3 ? 'total' : ''}${i === 6 && g.cantidadDescuadres ? ' warn' : ''}"><td>${i >= 3 ? `<strong>${c}</strong>` : c}</td><td class="num">${i >= 3 ? `<strong>${v}</strong>` : v}</td></tr>`,
    )
    .join('');

  const descRows = (g.descuadres ?? [])
    .map(
      (d) => `<tr>
        <td>#${d.idSesion}</td><td>${esc(d.usuario)}</td>
        <td class="num">${money(d.efectivoEsperado)}</td>
        <td class="num">${money(d.efectivoContado)}</td>
        <td class="num">${money(d.diferencia)}</td>
        <td>${fmtEstadoDescuadre(d.estado)}</td>
      </tr>`,
    )
    .join('');

  const alertaDesc =
    g.cantidadDescuadres && descRows
      ? `<div class="alerta"><strong>Novedades de descuadre (${g.cantidadDescuadres})</strong></div>
         <table class="tbl compact"><thead><tr><th>Sesión</th><th>Cajero</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Estado</th></tr></thead><tbody>${descRows}</tbody></table>`
      : '';

  const detSes = (g.detalleSesiones ?? [])
    .map(
      (s) => `<tr>
        <td>#${s.idSesion}</td><td>${esc(s.nombreCajero || s.usuario)}</td>
        <td class="num">${money(s.totalIngresos)}</td>
        <td class="num">${money(ingresosElectronicosSesion(s))}</td>
        <td class="num">${money(s.totalEgresos)}</td>
        <td class="num">${money(s.efectivoEsperado)}</td>
        <td class="num">${money(s.efectivoContado)}</td>
        <td class="num">${money(s.diferencia)}</td>
      </tr>`,
    )
    .join('');

  const ingDet = (g.ingresosDetalle ?? [])
    .map(
      (i) => `<tr>
        <td>#${i.idSesion}</td><td>${esc(i.usuario)}</td>
        <td>${esc(i.numRecibo || i.idIngreso)}</td>
        <td>${fmtFecha(i.fecha)}</td>
        <td>${esc(i.servicio)}</td>
        <td>${esc(resolverFormaPagoIngreso(i))}</td>
        <td>${esc(i.pagador || '—')}</td>
        <td class="num">${money(i.valor)}</td>
      </tr>`,
    )
    .join('');

  const egDet = (g.egresosDetalle ?? [])
    .map(
      (e) => `<tr>
        <td>#${e.idSesion}</td><td>${esc(e.usuario)}</td>
        <td>${esc(e.numRecibo || e.idEgreso)}</td>
        <td>${fmtFecha(e.fechaEgreso)}</td>
        <td>${esc(e.concepto)}</td>
        <td>${esc(e.formaPago || 'Efectivo')}</td>
        <td class="num">${money(e.valorEgreso)}</td>
      </tr>`,
    )
    .join('');

  const filasServicios =
    (g.ingresosPorServicio?.length ? g.ingresosPorServicio : null) ??
    g.ingresosPorServicioDetalle ??
    [];
  const resumenServ = htmlResumenPorServiciosCompacto(filasServicios);

  const saldoFormas = filasSaldoPorFormaPago(g);
  const htmlSaldo = htmlSaldoCaja(g, saldoFormas);
  const htmlFormas = htmlSaldoPorFormaPago(saldoFormas);

  const cuerpo = `
    <div class="doc-titulo-block">
      <h2>Informe general de cierre de cajas</h2>
      <p>${g.fechaDia ? `Día ${g.fechaDia} · ` : ''}${g.cantidadCajas} caja(s) consolidada(s)${sedeDocumentoLabel(empresa, g.idSede) ? ` · Sede ${esc(sedeDocumentoLabel(empresa, g.idSede))}` : ''}</p>
    </div>
    ${filaMetaSede(empresa, g.idSede) ? `<table class="doc-meta">${filaMetaSede(empresa, g.idSede)}</table>` : ''}
    <div class="sec">Resumen consolidado</div>
    <table class="tbl"><thead><tr><th>Concepto</th><th class="num">Valor (COP)</th></tr></thead><tbody>${filas}</tbody></table>
    ${htmlSaldo}
    ${htmlFormas}
    ${resumenServ}
    ${alertaDesc}
    <div class="sec">Detalle por caja</div>
    <p class="nota-forma-pago">Pagos electrónicos: transferencia, tarjeta crédito/débito, cheque, Nequi/Daviplata y otros medios no efectivo.</p>
    <table class="tbl compact"><thead><tr><th>Sesión</th><th>Cajero</th><th>Ingresos</th><th>Pagos electrónicos</th><th>Egresos</th><th>Esperado</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>${detSes}</tbody></table>
    <div class="sec-detalle">Detalle de ingresos (${g.ingresosDetalle?.length ?? 0})</div>
    <table class="tbl detalle">
      <thead><tr><th>Sesión</th><th>Cajero</th><th>Recibo</th><th>Fecha</th><th>Servicio</th><th>Pago</th><th>Recibido de</th><th class="num">Valor</th></tr></thead>
      <tbody>${ingDet || '<tr><td colspan="8">—</td></tr>'}</tbody>
      <tfoot><tr><td colspan="7"><strong>Total ingresos</strong></td><td class="num"><strong>${money(g.totalIngresos)}</strong></td></tr></tfoot>
    </table>
    <div class="sec-detalle">Detalle de egresos (${g.egresosDetalle?.length ?? 0})</div>
    <table class="tbl detalle">
      <thead><tr><th>Sesión</th><th>Cajero</th><th>Recibo</th><th>Fecha</th><th>Concepto</th><th>Forma pago</th><th class="num">Valor</th></tr></thead>
      <tbody>${egDet || '<tr><td colspan="7">—</td></tr>'}</tbody>
      <tfoot><tr><td colspan="6"><strong>Total egresos</strong></td><td class="num"><strong>${money(g.totalEgresos)}</strong></td></tr></tfoot>
    </table>`;

  return wrapDocumento('Informe general de cierre de cajas', cuerpo, empresa, g.idSede);
}
