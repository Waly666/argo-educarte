import { ColumnaInformeDef } from '../../core/services/informes.service';
import { ConfigRecibo } from '../../core/services/config.service';
import { encabezadoEmpresa } from '../../core/services/caja-informe-document';

export function imprimirInformeTabla(opts: {
  titulo: string;
  subtitulo?: string;
  columnas: ColumnaInformeDef[];
  filas: Record<string, unknown>[];
  empresa?: ConfigRecibo | null;
}): void {
  const { titulo, subtitulo, columnas, filas, empresa } = opts;
  const th = columnas
    .map((c) => `<th${c.tipo === 'moneda' ? ' class="num"' : ''}>${esc(c.etiqueta)}</th>`)
    .join('');
  const body = filas
    .map((row) => {
      const tds = columnas
        .map((c) => {
          const cls = c.tipo === 'moneda' ? ' class="num"' : '';
          return `<td${cls}>${esc(formatearCelda(row[c.clave], c.tipo))}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${esc(titulo)}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 12mm 10mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      width: 8.5in;
      min-height: 11in;
      padding: 12mm 10mm;
    }
    h1 {
      font-size: 13pt;
      font-weight: 700;
      margin: 0 0 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
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
      margin: 0 0 4px; font-size: 14pt; font-weight: 700; color: #1e3a5f;
    }
    .doc-empresa .doc-sede {
      margin: 0 0 6px; font-size: 11pt; font-weight: 600; color: #2d4a6f;
    }
    .doc-empresa p { margin: 0; font-size: 9pt; color: #333; }
    .informe-titulo { margin: 12px 0 8px; }
    .sub {
      color: #444;
      font-size: 9pt;
      margin-bottom: 10px;
      line-height: 1.35;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #bbb;
      padding: 4px 5px;
      text-align: left;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    th {
      background: #e8eef4;
      font-weight: 600;
      font-size: 8pt;
    }
    .num { text-align: right; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    @media print {
      body { padding: 0; width: auto; min-height: auto; }
    }
  </style>
</head>
<body>
  ${empresa ? encabezadoEmpresa(empresa) : ''}
  <h1 class="informe-titulo">${esc(titulo)}</h1>
  ${subtitulo ? `<div class="sub">${esc(subtitulo)}</div>` : ''}
  <table>
    <thead><tr>${th}</tr></thead>
    <tbody>${body || '<tr><td colspan="' + columnas.length + '">Sin datos</td></tr>'}</tbody>
  </table>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatearCelda(v: unknown, tipo: string): string {
  if (v == null || v === '') return '—';
  if (tipo === 'fecha') {
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('es-CO');
    }
  }
  if (tipo === 'moneda') {
    const n = Number(v);
    if (Number.isFinite(n)) {
      return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    }
  }
  return String(v);
}
